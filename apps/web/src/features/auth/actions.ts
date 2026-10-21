"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeAuthNextPath } from "@kensapo/domain";
import { attributionToUserMetadata } from "@/features/sales/attribution";
import { readAttributionFromCookies } from "@/features/sales/attribution-cookies";
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
  const attribution = attributionToUserMetadata(readAttributionFromCookies(await cookies()));
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      ...(attribution ? { data: attribution } : {}),
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
  if (formString(formData, "passkeyOffer") === "1") {
    redirect(`/settings/passkey?next=${encodeURIComponent(next || "/")}`);
  }
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
    if (/after \d+ seconds|rate limit|too many/i.test(error.message)) {
      return { error: "続けて送ろうとしたため止めました。1分ほど待ってから、もう一度お試しください。" };
    }
    return { error: "メールを送れませんでした。メールアドレスを確かめて、もう一度お試しください。" };
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
    if (/different from the old|same password/i.test(error.message)) {
      return { error: "前と同じパスワードは使えません。別のパスワードにしてください。" };
    }
    if (/weak|at least/i.test(error.message)) {
      return { error: "パスワードが簡単すぎます。英字と数字を混ぜて8文字以上にしてください。" };
    }
    return { error: "パスワードを変えられませんでした。もう一度、再設定のメールからやり直してください。" };
  }
  redirect("/");
}
