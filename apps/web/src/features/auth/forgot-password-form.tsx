"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "@/features/auth/actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, null);

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
      {state && "error" in state && state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state && "ok" in state ? (
        <p className="text-sm text-zinc-600">送信しました。届かない場合は迷惑メールを確認してください。</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl bg-zinc-900 px-4 text-base font-medium text-white disabled:opacity-60"
      >
        {pending ? "送信中…" : "リセット用メールを送る"}
      </button>
    </form>
  );
}
