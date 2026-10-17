"use server";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { decideRateLimit } from "@/lib/rate-limit-policy";
import { isSiteAdmin, requireWorkspace } from "@/lib/authz-guard";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { signInAsUser } from "@/lib/auth/sign-in-as";
import { ORG_COOKIE } from "@/lib/session";
import {
  CREW_DISPLAY_NAME,
  PASSCODE_MAX_LENGTH,
  PASSCODE_MIN_LENGTH,
  crewLoginEmail,
  generateLoginCode,
  hashPasscode,
  isValidLoginCode,
  isValidPasscode,
  normalizeLoginCode,
  normalizePasscode,
  verifyPasscode,
} from "@/lib/passcode";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PasscodeKind = "worker" | "admin";

const CREW_ROLE_ID = "00000000-0000-4000-a000-000000000009";
const NOT_READY = "合言葉ログインの準備ができていません。管理者にお問い合わせください。";
const WRONG = "会社コードか合言葉が正しくありません";

async function ensureLoginCode(admin: SupabaseClient, organizationId: string): Promise<string | null> {
  const { data } = await admin.from("organizations").select("login_code").eq("id", organizationId).maybeSingle();
  const current = (data as { login_code: string | null } | null)?.login_code;
  if (current) {
    return current;
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateLoginCode();
    const { error } = await admin
      .from("organizations")
      .update({ login_code: code })
      .eq("id", organizationId)
      .is("login_code", null);
    if (!error) {
      const check = await admin.from("organizations").select("login_code").eq("id", organizationId).maybeSingle();
      return (check.data as { login_code: string | null } | null)?.login_code ?? null;
    }
  }
  return null;
}

type PasscodeRow = { id: string; kind: PasscodeKind; profile_id: string; passcode_hash: string };

async function orgPasscodes(admin: SupabaseClient, organizationId: string): Promise<PasscodeRow[]> {
  const { data } = await admin
    .from("organization_passcodes")
    .select("id, kind, profile_id, passcode_hash")
    .eq("organization_id", organizationId);
  return (data as PasscodeRow[] | null) ?? [];
}

export async function getPasscodeStatusAction(): Promise<
  { ok: true; loginCode: string | null; worker: boolean; admin: boolean } | { ok: false; error: string }
> {
  const workspace = await requireWorkspace();
  if (!isSiteAdmin(workspace)) {
    return { ok: false, error: "管理者だけが確認できます" };
  }
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return { ok: false, error: "設定が未完了です（SUPABASE_SERVICE_ROLE_KEY）" };
  }
  const [{ data: org }, rows] = await Promise.all([
    admin.from("organizations").select("login_code").eq("id", workspace.organizationId).maybeSingle(),
    orgPasscodes(admin, workspace.organizationId),
  ]);
  return {
    ok: true,
    loginCode: (org as { login_code: string | null } | null)?.login_code ?? null,
    worker: rows.some((row) => row.kind === "worker"),
    admin: rows.some((row) => row.kind === "admin" && row.profile_id === workspace.userId),
  };
}

/**
 * 合言葉を設定する。
 * ・作業員の合言葉：会社に1つ。初回は共通ログイン用のアカウント（crew）を作る。
 * ・管理者の合言葉：設定した管理者本人のアカウントに紐づく。
 */
export async function setPasscodeAction(
  kind: PasscodeKind,
  rawPasscode: string,
): Promise<{ ok: true; loginCode: string } | { ok: false; error: string }> {
  const workspace = await requireWorkspace();
  if (!isSiteAdmin(workspace)) {
    return { ok: false, error: "管理者だけが設定できます" };
  }
  const passcode = normalizePasscode(rawPasscode ?? "");
  if (!isValidPasscode(passcode)) {
    return {
      ok: false,
      error: `合言葉は${PASSCODE_MIN_LENGTH}文字以上${PASSCODE_MAX_LENGTH}文字以内で入力してください`,
    };
  }
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return { ok: false, error: "設定が未完了です（SUPABASE_SERVICE_ROLE_KEY）" };
  }
  const organizationId = workspace.organizationId;
  const loginCode = await ensureLoginCode(admin, organizationId);
  if (!loginCode) {
    return { ok: false, error: "会社コードを作れませんでした。もう一度お試しください。" };
  }

  const rows = await orgPasscodes(admin, organizationId);
  const others = rows.filter((row) => !(row.kind === kind && (kind === "worker" || row.profile_id === workspace.userId)));
  for (const row of others) {
    if (await verifyPasscode(passcode, row.passcode_hash)) {
      return { ok: false, error: "ほかの合言葉と同じです。別の合言葉にしてください。" };
    }
  }

  const hash = await hashPasscode(passcode);

  if (kind === "admin") {
    const { error } = await admin.from("organization_passcodes").upsert(
      {
        organization_id: organizationId,
        kind: "admin",
        profile_id: workspace.userId,
        passcode_hash: hash,
        updated_by: workspace.userId,
      },
      { onConflict: "organization_id,kind,profile_id" },
    );
    return error ? { ok: false, error: "保存できませんでした。もう一度お試しください。" } : { ok: true, loginCode };
  }

  const existing = rows.find((row) => row.kind === "worker");
  if (existing) {
    const { error } = await admin
      .from("organization_passcodes")
      .update({ passcode_hash: hash, updated_by: workspace.userId })
      .eq("id", existing.id);
    return error ? { ok: false, error: "保存できませんでした。もう一度お試しください。" } : { ok: true, loginCode };
  }

  // 初回：共通ログイン用のアカウントを作る（メールは送らない・パスワードは誰も知らない）
  const created = await admin.auth.admin.createUser({
    email: crewLoginEmail(organizationId),
    password: randomBytes(32).toString("base64url"),
    email_confirm: true,
    user_metadata: { display_name: CREW_DISPLAY_NAME, kind: "crew-shared-login" },
    app_metadata: { kenbei_crew_org: organizationId },
  });
  const crewUserId = created.data.user?.id;
  if (created.error || !crewUserId) {
    return { ok: false, error: "合言葉の準備に失敗しました。もう一度お試しください。" };
  }
  const inserted = await admin.from("organization_passcodes").insert({
    organization_id: organizationId,
    kind: "worker",
    profile_id: crewUserId,
    passcode_hash: hash,
    updated_by: workspace.userId,
  });
  if (inserted.error) {
    await admin.auth.admin.deleteUser(crewUserId);
    return { ok: false, error: "合言葉の準備に失敗しました。もう一度お試しください。" };
  }
  const membership = await admin.from("memberships").insert({
    organization_id: organizationId,
    profile_id: crewUserId,
    role_id: CREW_ROLE_ID,
    status: "active",
    created_by: workspace.userId,
    updated_by: workspace.userId,
  });
  if (membership.error) {
    await admin.from("organization_passcodes").delete().eq("organization_id", organizationId).eq("kind", "worker");
    await admin.auth.admin.deleteUser(crewUserId);
    if (/KENBEI_SEAT_LIMIT/.test(membership.error.message)) {
      return { ok: false, error: "メンバーの人数が上限です。共通ログインも1人分として数えます。" };
    }
    return { ok: false, error: "合言葉の準備に失敗しました。もう一度お試しください。" };
  }
  return { ok: true, loginCode };
}

/** 共通ログインの端末をすべてログアウトさせる。合言葉を変えたあとに使う。 */
export async function revokeCrewSessionsAction(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const workspace = await requireWorkspace();
  if (!isSiteAdmin(workspace)) {
    return { ok: false, error: "管理者だけが操作できます" };
  }
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return { ok: false, error: "設定が未完了です（SUPABASE_SERVICE_ROLE_KEY）" };
  }
  const { data, error } = await admin.rpc("revoke_crew_sessions", { p_organization_id: workspace.organizationId });
  if (error) {
    return { ok: false, error: "ログアウトさせられませんでした。もう一度お試しください。" };
  }
  return { ok: true, count: typeof data === "number" ? data : 0 };
}

async function consumeLoginRateLimit(admin: SupabaseClient, key: string, max: number): Promise<boolean> {
  const result = decideRateLimit(
    await admin.rpc("consume_rate_limit", { p_key: key, p_max: max, p_window_seconds: 600 }),
  );
  return result.allowed;
}

async function isActiveMember(admin: SupabaseClient, organizationId: string, profileId: string, kind: PasscodeKind) {
  const { data } = await admin
    .from("memberships")
    .select("id, roles(code, role_permissions(permission_code))")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  const row = data as
    | {
        id: string;
        roles:
          | { code: string; role_permissions: { permission_code: string }[] | null }
          | { code: string; role_permissions: { permission_code: string }[] | null }[]
          | null;
      }
    | null;
  if (!row) {
    return false;
  }
  const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
  if (kind === "worker") {
    return role?.code === "crew";
  }
  return (role?.role_permissions ?? []).some((item) => item.permission_code === "project.create");
}

/** 会社コード＋合言葉でログインする。サーバーで照合し、そのアカウントの通常のセッションを作る。 */
export async function passcodeLoginAction(input: {
  loginCode: string;
  passcode: string;
  kind: PasscodeKind;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const kind: PasscodeKind = input.kind === "admin" ? "admin" : "worker";
  const loginCode = normalizeLoginCode(input.loginCode ?? "");
  const passcode = normalizePasscode(input.passcode ?? "");
  if (!isValidLoginCode(loginCode)) {
    return { ok: false, error: "会社コード（6桁の数字）を入力してください" };
  }
  if (!passcode) {
    return { ok: false, error: "合言葉を入力してください" };
  }

  const admin = createAdminSupabaseClient();
  if (!admin) {
    return { ok: false, error: NOT_READY };
  }
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown";
  const [ipOk, codeOk] = await Promise.all([
    consumeLoginRateLimit(admin, `passcode-login:ip:${ip}`, 10),
    consumeLoginRateLimit(admin, `passcode-login:org:${loginCode}`, 30),
  ]);
  if (!ipOk || !codeOk) {
    return { ok: false, error: "しばらく待ってから、もう一度お試しください。" };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("id, status, deleted_at")
    .eq("login_code", loginCode)
    .maybeSingle();
  const organization = org as { id: string; status: string; deleted_at: string | null } | null;
  if (!organization || organization.deleted_at || organization.status !== "active") {
    return { ok: false, error: WRONG };
  }

  const rows = (await orgPasscodes(admin, organization.id)).filter((row) => row.kind === kind);
  let profileId: string | null = null;
  for (const row of rows) {
    if (await verifyPasscode(passcode, row.passcode_hash)) {
      profileId = row.profile_id;
      break;
    }
  }
  if (!profileId || !(await isActiveMember(admin, organization.id, profileId, kind))) {
    return { ok: false, error: WRONG };
  }

  if (!(await signInAsUser(admin, profileId))) {
    return { ok: false, error: "ログインに失敗しました。もう一度お試しください。" };
  }
  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, organization.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true };
}
