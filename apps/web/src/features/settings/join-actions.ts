"use server";

import { redirect } from "next/navigation";
import {
  alreadyInCompanyMessage,
  inviteAccountExistsMessage,
  inviteEmailMismatchMessage,
  inviteJoinPath,
  normalizeInviteEmail,
} from "@kensapo/domain";
import { firstInvitePreview } from "@/features/settings/invite-preview";
import { getAppUrl } from "@/lib/env";
import { formString } from "@/lib/form";
import { writeJoinNextCookie } from "@/lib/invite-next";
import { getWorkspace, hasOrganization } from "@/lib/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

export async function joinSignupAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const token = formString(formData, "token");
  const password = formString(formData, "password");
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
  redirect(`/signup/check-email?next=${encodeURIComponent(next)}`);
}

export async function signOutToJoinAction(formData: FormData): Promise<void> {
  const token = formString(formData, "token");
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect(inviteJoinPath(token));
}
