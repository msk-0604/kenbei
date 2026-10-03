"use client";

import { useActionState } from "react";
import { resendInviteSignupEmailAction } from "@/features/settings/join-actions";

export function CheckEmailResend({ email, nextPath }: { email: string; nextPath?: string | null }) {
  const [state, action, pending] = useActionState(resendInviteSignupEmailAction, null);
  if (!email) {
    return null;
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="email" value={email} />
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <button
        type="submit"
        disabled={pending || Boolean(state?.ok)}
        className="kb-tap min-h-12 rounded-2xl bg-white font-medium ring-1 ring-[var(--kb-line)] disabled:opacity-60"
      >
        {pending ? "送信中…" : state?.ok ? "✓ 確認メールを再送しました" : "確認メールをもう一度送る"}
      </button>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
