"use client";

import { useActionState } from "react";
import { createOrganizationAction } from "@/features/org/actions";
import { TRADE_TEMPLATES } from "@/lib/trade-progress-templates";

export function CreateOrganizationForm() {
  const [state, action, pending] = useActionState(createOrganizationAction, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        会社名
        <input
          name="name"
          type="text"
          required
          autoFocus
          autoComplete="organization"
          enterKeyHint="done"
          placeholder="例: 山田建設"
          className="rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900"
        />
      </label>
      <p className="text-sm leading-6 text-zinc-500">現場名（マンション名・工事名）ではありません。</p>
      <label className="flex flex-col gap-1 text-sm font-medium">
        あなたのお名前
        <input
          name="displayName"
          type="text"
          required
          autoComplete="name"
          placeholder="例: 山田 太郎"
          className="rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900"
        />
      </label>
      <p className="text-sm leading-6 text-zinc-500">日報の「記入者」として表示されます。</p>
      <label className="flex flex-col gap-1 text-sm font-medium">
        業種
        <select
          name="trade"
          defaultValue="plumbing"
          className="min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900"
        >
          {TRADE_TEMPLATES.map((template) => (
            <option key={template.key} value={template.key}>
              {template.label}
            </option>
          ))}
          <option value="other">そのほか（あとで決める）</option>
        </select>
      </label>
      <p className="text-sm leading-6 text-zinc-500">その業種のよく使う工程を、最初から入れておきます。あとで直せます。</p>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl bg-zinc-900 px-4 text-base font-medium text-white disabled:opacity-60"
      >
        {pending ? "作成中…" : "会社を作成して始める"}
      </button>
    </form>
  );
}
