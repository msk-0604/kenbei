"use client";

import { useActionState } from "react";
import { updateDisplayNameAction } from "@/features/profile/actions";

export function DisplayNameForm({ defaultName, compact = false }: { defaultName: string; compact?: boolean }) {
  const [state, action, pending] = useActionState(updateDisplayNameAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className={compact ? "flex gap-2" : "flex flex-col gap-2"}>
        <input
          name="displayName"
          required
          defaultValue={defaultName}
          autoComplete="name"
          placeholder="例: 山本 真樹"
          aria-label="お名前"
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="kb-tap shrink-0 rounded-2xl bg-[var(--kb-ink)] px-4 font-medium text-white disabled:opacity-60"
        >
          {pending ? "保存中…" : "保存"}
        </button>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-emerald-700">✓ お名前を保存しました</p> : null}
    </form>
  );
}
