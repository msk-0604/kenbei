"use client";

import { useActionState } from "react";
import { DRAWING_KIND_LABELS } from "@kensapo/domain";
import { uploadProjectDrawingAction } from "@/features/drawings/actions";
import type { ProjectDrawing } from "@/features/drawings/queries";

export function DrawingUploadForm({
  projectId,
  series,
}: {
  projectId: string;
  series: ProjectDrawing[];
}) {
  const [state, action, pending] = useActionState(uploadProjectDrawingAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input name="title" required placeholder="図面名" className="rounded-xl border border-zinc-200 px-4" />
      <select name="drawingKind" defaultValue="plan" className="rounded-xl border border-zinc-200 px-3">
        {Object.entries(DRAWING_KIND_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select name="seriesId" defaultValue="" className="rounded-xl border border-zinc-200 px-3">
        <option value="">新規図面</option>
        {series.map((item) => (
          <option key={item.seriesId} value={item.seriesId}>
            {item.title} の新バージョン
          </option>
        ))}
      </select>
      <input type="file" name="file" required accept="application/pdf" />
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-2xl bg-zinc-900 font-medium text-white">
        {pending ? "登録中…" : "PDFを登録"}
      </button>
    </form>
  );
}
