"use client";

import { useActionState } from "react";
import { DOCUMENT_KIND_LABELS } from "@kensapo/domain";
import { uploadDocumentAction } from "@/features/knowledge/actions";

export function KnowledgeUploadForm() {
  const [state, action, pending] = useActionState(uploadDocumentAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input name="title" required placeholder="資料名" className="rounded-xl border border-zinc-200 px-4" />
      <select name="kind" defaultValue="rule" className="rounded-xl border border-zinc-200 px-3">
        {Object.entries(DOCUMENT_KIND_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <input name="description" placeholder="説明（任意）" className="rounded-xl border border-zinc-200 px-4" />
      <input type="file" name="file" required accept="application/pdf,image/jpeg,image/png,text/plain" />
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-2xl bg-zinc-900 font-medium text-white">
        {pending ? "登録中…" : "資料を登録"}
      </button>
    </form>
  );
}
