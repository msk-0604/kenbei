"use client";

import { useActionState } from "react";
import { joinSignupAction } from "@/features/settings/join-actions";

export function JoinSignupForm({
  token,
  invitedEmail,
  emailLocked,
}: {
  token: string;
  invitedEmail?: string;
  emailLocked: boolean;
}) {
  const [state, action, pending] = useActionState(joinSignupAction, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        メールアドレス
        <input
          name="email"
          type="email"
          required
          defaultValue={invitedEmail}
          readOnly={emailLocked}
          autoComplete="email"
          className="rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900 read-only:bg-zinc-50"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        パスワード
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900"
        />
      </label>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl bg-[var(--kb-ink)] px-4 text-base font-medium text-white disabled:opacity-60"
      >
        {pending ? "送信中…" : "アカウントを作成して参加"}
      </button>
    </form>
  );
}
