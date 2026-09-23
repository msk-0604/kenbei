"use server";

import { redirect } from "next/navigation";
import {
  alreadyInCompanyMessage,
  canSkipInviteEmailConfirmation,
  inviteAccountExistsMessage,
  inviteCheckEmailPath,
  inviteEmailMismatchMessage,
  inviteJoinPath,
  normalizeInviteEmail,
  safeAuthNextPath,
} from "@kensapo/domain";
import { firstInvitePreview } from "@/features/settings/invite-preview";
import { acceptInviteForCurrentUser } from "@/features/settings/accept-invite";
import { getAppUrl } from "@/lib/env";
import { formString } from "@/lib/form";
import { writeJoinNextCookie } from "@/lib/invite-next";
import {
  hashInviteSignupGrant,
  isMissingInviteSignupGrantRpc,
  readInviteSignupGrant,
} from "@/lib/invite-signup-grant";
import { getWorkspace, hasOrganization } from "@/lib/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

function inviteStateError(state: string | null | undefined): string | null {
  if (state === "used") {
    return "この招待リンクは使われています。";
  }
  if (state === "expired") {
    return "招待の期限が切れています。";
  }
  if (state && state !== "ok") {
    return "リンクが無効です。";
  }
  return null;
}

function firstConsumedEmail(data: unknown): string | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return null;
  }
  const value = (row as { invited_email?: unknown }).invited_email;
  return typeof value === "string" ? normalizeInviteEmail(value) : null;
}

export async function joinSignupAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const token = formString(formData, "token");
  const password = formString(formData, "password");
  const grant = readInviteSignupGrant(formString(formData, "grant"));
  if (!token) {
    return { error: "招待リンクが必要です。" };
  }
  if (password.length < 8) {
    return { error: "パスワードは8文字以上にしてください。" };
  }

  const supabase = await createServerSupabaseClient();
  const preview = await supabase.rpc("preview_organization_invite", { p_token: token });
  const row = firstInvitePreview(preview.data);
  const invalid = inviteStateError(row?.invite_state);
  if (invalid) {
    return { error: invalid };
  }

  const invitedEmail = normalizeInviteEmail(row?.invited_email);
  const submitted = normalizeInviteEmail(formString(formData, "email"));
  if (invitedEmail && submitted && submitted !== invitedEmail) {
    return { error: inviteEmailMismatchMessage() };
  }
  const email = invitedEmail ?? submitted;
  if (!email) {
    return { error: "メールアドレスを入力してください。" };
  }

  const workspace = await getWorkspace();
  if (workspace && hasOrganization(workspace)) {
    return { error: alreadyInCompanyMessage(workspace.organizationName || "今の会社") };
  }
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const currentEmail = normalizeInviteEmail(currentUser?.email);
  if (currentEmail && currentEmail !== email) {
    return { error: inviteEmailMismatchMessage() };
  }
  if (currentUser && currentEmail === email) {
    const accepted = await acceptInviteForCurrentUser(token);
    if ("error" in accepted) {
      return { error: accepted.error };
    }
    redirect("/");
  }

  if (grant) {
    const redeemed = await redeemInviteSignupAndJoin({
      token,
      grant,
      email,
      password,
    });
    if (redeemed) {
      return redeemed;
    }
  }

  const next = inviteJoinPath(token);
  await writeJoinNextCookie(next);
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return { error: inviteAccountExistsMessage() };
    }
    return { error: error.message };
  }
  redirect(
    inviteCheckEmailPath({
      next,
      companyName: row?.company_name,
      email,
    }),
  );
}

async function redeemInviteSignupAndJoin(input: {
  token: string;
  grant: string;
  email: string;
  password: string;
}): Promise<{ error: string } | null> {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return null;
  }
  if (await authUserExistsByEmail(input.email)) {
    return { error: inviteAccountExistsMessage() };
  }

  const consumed = await admin.rpc("consume_invite_signup_grant", {
    p_token: input.token,
    p_grant: input.grant,
  });
  if (consumed.error) {
    if (isMissingInviteSignupGrantRpc(consumed.error.message)) {
      return null;
    }
    return { error: "登録を完了できませんでした。時間をおいてやり直すか、確認メールのリンクから参加してください。" };
  }
  const redeemedEmail = firstConsumedEmail(consumed.data);
  if (!canSkipInviteEmailConfirmation({ grantRedeemed: Boolean(redeemedEmail) }) || !redeemedEmail) {
    return {
      error:
        "この登録用リンクは無効か、すでに使われています。コピーしたリンクから確認メールで参加するか、管理者に再送を依頼してください。",
    };
  }
  if (redeemedEmail !== input.email) {
    await releaseInviteSignupGrant(admin, input.token, input.grant);
    return { error: inviteEmailMismatchMessage() };
  }

  const created = await admin.auth.admin.createUser({
    email: redeemedEmail,
    password: input.password,
    email_confirm: true,
  });
  if (created.error) {
    await releaseInviteSignupGrant(admin, input.token, input.grant);
    if (/already|registered|exists/i.test(created.error.message)) {
      return { error: inviteAccountExistsMessage() };
    }
    return { error: created.error.message };
  }

  const supabase = await createServerSupabaseClient();
  const signed = await supabase.auth.signInWithPassword({
    email: redeemedEmail,
    password: input.password,
  });
  if (signed.error) {
    return { error: signed.error.message };
  }
  const accepted = await acceptInviteForCurrentUser(input.token);
  if ("error" in accepted) {
    return { error: accepted.error };
  }
  redirect("/");
}

export async function resendInviteSignupEmailAction(
  _prev: { error?: string; ok?: true } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: true } | null> {
  const email = normalizeInviteEmail(formString(formData, "email"));
  const next = safeAuthNextPath(formString(formData, "next"));
  if (!email) {
    return { error: "確認メールを再送するメールアドレスがありません。" };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: next
        ? `${getAppUrl()}/auth/callback?next=${encodeURIComponent(next)}`
        : `${getAppUrl()}/auth/callback`,
    },
  });
  if (error) {
    return { error: error.message };
  }
  return { ok: true };
}

export async function signOutToJoinAction(formData: FormData): Promise<void> {
  const token = formString(formData, "token");
  const grant = readInviteSignupGrant(formString(formData, "grant"));
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect(inviteJoinPath(token, grant));
}

async function authUserExistsByEmail(email: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return false;
  }
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
  if (!response.ok) {
    return false;
  }
  const body = (await response.json()) as { users?: { email?: string }[]; user?: { email?: string } };
  const users = body.users ?? (body.user ? [body.user] : []);
  return users.some((user) => normalizeInviteEmail(user.email) === email);
}

async function releaseInviteSignupGrant(admin: SupabaseClient, token: string, grant: string): Promise<void> {
  await admin
    .from("organization_invitations")
    .update({ signup_grant_used_at: null })
    .eq("token", token)
    .eq("signup_grant_hash", hashInviteSignupGrant(grant));
}
