"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/features/auth/actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        新しいパスワード
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
        {pending ? "更新中…" : "パスワードを更新"}
      </button>
    </form>
  );
}
