"use client";

import { useActionState } from "react";
import { signInAction } from "@/features/auth/actions";

export function SignInForm({ nextPath }: { nextPath?: string }) {
  const [state, action, pending] = useActionState(signInAction, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <label className="flex flex-col gap-1 text-sm font-medium">
        メールアドレス
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        パスワード
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900"
        />
      </label>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl bg-[var(--kb-ink)] px-4 text-base font-medium text-white disabled:opacity-60"
      >
        {pending ? "サインイン中…" : "サインイン"}
      </button>
    </form>
  );
}
