"use server";

import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/env";
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

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getAppUrl()}/auth/callback`,
    },
  });
  if (error) {
    return { error: error.message };
  }
  redirect("/signup/check-email");
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
      return { error: "メールが未確認です。届いていなくても、Supabase の Users で Confirm すれば入れます。" };
    }
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }
  const next = formString(formData, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
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
