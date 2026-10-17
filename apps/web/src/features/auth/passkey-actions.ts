"use server";

import { headers } from "next/headers";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isCrewLogin, requireWorkspace } from "@/lib/authz-guard";
import { signInAsUser } from "@/lib/auth/sign-in-as";
import {
  PASSKEY_RP_NAME,
  base64UrlToBytes,
  bytesToBase64Url,
  deviceNameFromUserAgent,
  isAllowedPasskeyHost,
  relyingParty,
} from "@/lib/auth/passkey";
import { getAppUrl } from "@/lib/env";
import { decideRateLimit } from "@/lib/rate-limit-policy";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const NOT_READY = "顔認証の準備ができていません。メールアドレスでログインしてください。";
const FAILED = "顔認証でログインできませんでした。メールアドレスでログインしてください。";

type PasskeyRow = {
  id: string;
  profile_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[] | null;
};

async function currentRelyingParty(): Promise<{ rpID: string; origin: string } | null> {
  const store = await headers();
  const rp = relyingParty(store.get("x-forwarded-host") ?? store.get("host"), store.get("x-forwarded-proto"));
  if (!rp || !isAllowedPasskeyHost(rp.rpID, getAppUrl())) {
    return null;
  }
  return rp;
}

async function clientIp(): Promise<string> {
  const store = await headers();
  return store.get("x-forwarded-for")?.split(",")[0]?.trim() || store.get("x-real-ip") || "unknown";
}

async function rateLimited(admin: SupabaseClient, key: string, max: number): Promise<boolean> {
  const result = decideRateLimit(await admin.rpc("consume_rate_limit", { p_key: key, p_max: max, p_window_seconds: 600 }));
  return !result.allowed;
}

/** 使い終わった・古いチャレンジを掃除する（失敗しても気にしない） */
async function sweepChallenges(admin: SupabaseClient): Promise<void> {
  await admin.from("webauthn_challenges").delete().lt("expires_at", new Date().toISOString());
}

/** チャレンジを1回だけ取り出す（取り出したら消す） */
async function takeChallenge(
  admin: SupabaseClient,
  id: string,
  kind: "register" | "login",
  profileId: string | null,
): Promise<string | null> {
  let query = admin
    .from("webauthn_challenges")
    .delete()
    .eq("id", id)
    .eq("kind", kind)
    .gt("expires_at", new Date().toISOString());
  query = profileId ? query.eq("profile_id", profileId) : query.is("profile_id", null);
  const { data } = await query.select("challenge").maybeSingle();
  return (data as { challenge: string } | null)?.challenge ?? null;
}

/** このスマホの顔認証を登録する準備（ログイン中の本人だけ・共通ログインは不可） */
export async function passkeyRegistrationOptionsAction(): Promise<
  { ok: true; challengeId: string; options: PublicKeyCredentialCreationOptionsJSON } | { ok: false; error: string }
> {
  const workspace = await requireWorkspace();
  if (isCrewLogin(workspace)) {
    return { ok: false, error: "共通ログイン（合言葉）では顔認証を登録できません。自分のメールアドレスでログインしてください。" };
  }
  const admin = createAdminSupabaseClient();
  const rp = await currentRelyingParty();
  if (!admin || !rp) {
    return { ok: false, error: NOT_READY };
  }
  if (await rateLimited(admin, `passkey-register:${workspace.userId}`, 20)) {
    return { ok: false, error: "しばらく待ってから、もう一度お試しください。" };
  }
  const existing = await admin.from("user_passkeys").select("credential_id, transports").eq("profile_id", workspace.userId);
  const options = await generateRegistrationOptions({
    rpName: PASSKEY_RP_NAME,
    rpID: rp.rpID,
    userName: workspace.email ?? workspace.displayName,
    userDisplayName: workspace.displayName,
    userID: new TextEncoder().encode(workspace.userId),
    attestationType: "none",
    excludeCredentials: ((existing.data as { credential_id: string; transports: string[] | null }[] | null) ?? []).map((row) => ({
      id: row.credential_id,
      transports: (row.transports ?? []) as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  await sweepChallenges(admin);
  const { data, error } = await admin
    .from("webauthn_challenges")
    .insert({ kind: "register", profile_id: workspace.userId, challenge: options.challenge })
    .select("id")
    .maybeSingle();
  const challengeId = (data as { id: string } | null)?.id;
  if (error || !challengeId) {
    return { ok: false, error: NOT_READY };
  }
  return { ok: true, challengeId, options };
}

export async function verifyPasskeyRegistrationAction(
  challengeId: string,
  response: RegistrationResponseJSON,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const workspace = await requireWorkspace();
  if (isCrewLogin(workspace)) {
    return { ok: false, error: "共通ログイン（合言葉）では顔認証を登録できません。" };
  }
  const admin = createAdminSupabaseClient();
  const rp = await currentRelyingParty();
  if (!admin || !rp) {
    return { ok: false, error: NOT_READY };
  }
  const expectedChallenge = await takeChallenge(admin, String(challengeId), "register", workspace.userId);
  if (!expectedChallenge) {
    return { ok: false, error: "時間が経ちすぎました。もう一度お試しください。" };
  }
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: true,
    });
  } catch {
    return { ok: false, error: "顔認証を登録できませんでした。もう一度お試しください。" };
  }
  if (!verification.verified) {
    return { ok: false, error: "顔認証を登録できませんでした。もう一度お試しください。" };
  }
  const { credential } = verification.registrationInfo;
  const store = await headers();
  const { error } = await admin.from("user_passkeys").insert({
    profile_id: workspace.userId,
    credential_id: credential.id,
    public_key: bytesToBase64Url(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? [],
    device_name: deviceNameFromUserAgent(store.get("user-agent")),
  });
  if (error) {
    return { ok: false, error: "この端末はもう登録されています。" };
  }
  return { ok: true };
}

/** 顔認証でログインする準備（ログイン前・だれのものかは端末が選ぶ） */
export async function passkeyLoginOptionsAction(): Promise<
  { ok: true; challengeId: string; options: PublicKeyCredentialRequestOptionsJSON } | { ok: false; error: string }
> {
  const admin = createAdminSupabaseClient();
  const rp = await currentRelyingParty();
  if (!admin || !rp) {
    return { ok: false, error: NOT_READY };
  }
  if (await rateLimited(admin, `passkey-login:ip:${await clientIp()}`, 30)) {
    return { ok: false, error: "しばらく待ってから、もう一度お試しください。" };
  }
  const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: "required" });
  await sweepChallenges(admin);
  const { data, error } = await admin
    .from("webauthn_challenges")
    .insert({ kind: "login", profile_id: null, challenge: options.challenge })
    .select("id")
    .maybeSingle();
  const challengeId = (data as { id: string } | null)?.id;
  if (error || !challengeId) {
    return { ok: false, error: NOT_READY };
  }
  return { ok: true, challengeId, options };
}

export async function verifyPasskeyLoginAction(
  challengeId: string,
  response: AuthenticationResponseJSON,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminSupabaseClient();
  const rp = await currentRelyingParty();
  if (!admin || !rp) {
    return { ok: false, error: NOT_READY };
  }
  const expectedChallenge = await takeChallenge(admin, String(challengeId), "login", null);
  if (!expectedChallenge) {
    return { ok: false, error: "時間が経ちすぎました。もう一度お試しください。" };
  }
  const found = await admin
    .from("user_passkeys")
    .select("id, profile_id, credential_id, public_key, counter, transports")
    .eq("credential_id", String(response?.id ?? ""))
    .maybeSingle();
  const passkey = found.data as PasskeyRow | null;
  if (!passkey) {
    return { ok: false, error: "この端末の顔認証は登録されていません。メールアドレスでログインしてから登録してください。" };
  }
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: true,
      credential: {
        id: passkey.credential_id,
        publicKey: base64UrlToBytes(passkey.public_key),
        counter: Number(passkey.counter),
        transports: (passkey.transports ?? []) as AuthenticatorTransportFuture[],
      },
    });
  } catch {
    return { ok: false, error: FAILED };
  }
  if (!verification.verified) {
    return { ok: false, error: FAILED };
  }
  await admin
    .from("user_passkeys")
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq("id", passkey.id);
  if (!(await signInAsUser(admin, passkey.profile_id))) {
    return { ok: false, error: FAILED };
  }
  return { ok: true };
}

export type PasskeyListItem = { id: string; deviceName: string; createdAt: string; lastUsedAt: string | null };

/** 自分が登録した顔認証の一覧 */
export async function listMyPasskeysAction(): Promise<PasskeyListItem[]> {
  const workspace = await requireWorkspace();
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return [];
  }
  const { data } = await admin
    .from("user_passkeys")
    .select("id, device_name, created_at, last_used_at")
    .eq("profile_id", workspace.userId)
    .order("created_at", { ascending: false });
  return ((data as { id: string; device_name: string | null; created_at: string; last_used_at: string | null }[] | null) ?? []).map(
    (row) => ({ id: row.id, deviceName: row.device_name ?? "この端末", createdAt: row.created_at, lastUsedAt: row.last_used_at }),
  );
}

export async function deleteMyPasskeyAction(id: string): Promise<{ ok: boolean }> {
  const workspace = await requireWorkspace();
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return { ok: false };
  }
  const { error } = await admin.from("user_passkeys").delete().eq("id", String(id)).eq("profile_id", workspace.userId);
  return { ok: !error };
}
