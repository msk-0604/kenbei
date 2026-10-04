"use server";

import { redirect } from "next/navigation";
import { safeAuthNextPath } from "@kensapo/domain";
import { getAppUrl } from "@/lib/env";
import { writeJoinNextCookie } from "@/lib/invite-next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signUpAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const email = formString(formData, "email");
  const password = formString(formData, "password");
  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }
  if (password.length < 8) {
    return { error: "パスワードは8文字以上にしてください。" };
  }

  const safeNext = safeAuthNextPath(formString(formData, "next"));
  await writeJoinNextCookie(safeNext);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: safeNext
        ? `${getAppUrl()}/auth/callback?next=${encodeURIComponent(safeNext)}`
        : `${getAppUrl()}/auth/callback`,
    },
  });
  if (error) {
    return { error: signUpErrorMessage(error.message) };
  }
  // Supabase answers an already-registered address with a user that has no
  // identities and sends no email, so say so instead of waiting for a mail.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return {
      error: "このメールアドレスはすでに登録されています。ログインするか、「パスワードを忘れた」から再設定してください。",
    };
  }
  // Email confirmation turned off: the user is signed in already.
  if (data.session) {
    redirect(safeNext || "/onboarding");
  }
  const query = new URLSearchParams({ email });
  if (safeNext) {
    query.set("next", safeNext);
  }
  redirect(`/signup/check-email?${query.toString()}`);
}

function signUpErrorMessage(message: string): string {
  if (/rate limit|too many/i.test(message)) {
    return "短時間に何度も送信されました。数分待ってから、もう一度お試しください。";
  }
  if (/invalid.*email|email.*invalid/i.test(message)) {
    return "メールアドレスの形式を確認してください。";
  }
  if (/password/i.test(message)) {
    return "パスワードは8文字以上で、推測されにくいものにしてください。";
  }
  return "登録できませんでした。時間をおいて、もう一度お試しください。";
}

export async function signInAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const email = formString(formData, "email");
  const password = formString(formData, "password");
  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
      return { error: "メールが未確認です。届いた確認メールのリンクを開いてから、もう一度ログインしてください。" };
    }
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }
  const next = safeAuthNextPath(formString(formData, "next"));
  await writeJoinNextCookie(next);
  redirect(next || "/");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prev: { error: string } | { ok: true } | null,
  formData: FormData,
): Promise<{ error: string } | { ok: true } | null> {
  const email = formString(formData, "email");
  if (!email || !email.includes("@")) {
    return { error: "メールアドレスを入力してください。" };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppUrl()}/auth/callback?next=/reset-password`,
  });
  if (error) {
    return { error: error.message };
  }
  return { ok: true };
}

export async function updatePasswordAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const password = formString(formData, "password");
  if (password.length < 8) {
    return { error: "パスワードは8文字以上にしてください。" };
  }
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }
  redirect("/");
}
