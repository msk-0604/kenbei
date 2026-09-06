"use client";

import { useActionState } from "react";
import { signUpAction } from "@/features/auth/actions";

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, null);

  return (
    <form action={action} className="flex flex-col gap-4">
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
          minLength={8}
          autoComplete="new-password"
          className="rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900"
        />
      </label>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl bg-zinc-900 px-4 text-base font-medium text-white disabled:opacity-60"
      >
        {pending ? "作成中…" : "アカウントを作成"}
      </button>
    </form>
  );
}
