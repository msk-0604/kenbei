"use client";

import { useActionState, useState } from "react";
import { confirmReportAction, createTodayReportDraftAction, saveReportAction } from "@/features/reports/actions";
import type { DailyReportRecord } from "@/features/reports/queries";
import type { PhotoRecord } from "@/features/photos/queries";

export function CreateTodayReportButton({ projectId }: { projectId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        className="rounded-2xl bg-zinc-900 font-medium text-white"
        onClick={() => {
          setPending(true);
          void createTodayReportDraftAction(projectId).then((result) => {
            if (result?.error) {
              setError(result.error);
              setPending(false);
            }
          });
        }}
      >
        {pending ? "下書き作成中…" : "今日の日報を作成"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function ConfirmReportButton({ reportId, disabled }: { reportId: string; disabled: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled || pending}
        className="rounded-2xl bg-zinc-900 font-medium text-white disabled:opacity-40"
        onClick={() => {
          setPending(true);
          void confirmReportAction(reportId).then((result) => {
            setPending(false);
            setError(result?.error ?? null);
            if (!result?.error) {
              window.location.reload();
            }
          });
        }}
      >
        {pending ? "確定中…" : "確定する"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function ReportEditor({
  report,
  photos,
}: {
  report: DailyReportRecord;
  photos: PhotoRecord[];
}) {
  const [state, action, pending] = useActionState(saveReportAction, null);
  const selected = new Set(report.photoIds);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="reportId" value={report.id} />
      <label className="text-sm font-medium">
        天候
        <input name="weather" defaultValue={report.weather ?? ""} className="mt-1 w-full rounded-xl border border-zinc-200 px-4" />
      </label>
      <label className="text-sm font-medium">
        作業箇所
        <input name="workLocation" defaultValue={report.workLocation ?? ""} className="mt-1 w-full rounded-xl border border-zinc-200 px-4" />
      </label>
      <label className="text-sm font-medium">
        作業人数
        <input
          name="workerCount"
          type="number"
          defaultValue={report.workerCount == null ? "" : String(report.workerCount)}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-4"
        />
      </label>
      <label className="text-sm font-medium">
        協力会社
        <input name="partnerCompaniesText" defaultValue={report.partnerCompaniesText ?? ""} className="mt-1 w-full rounded-xl border border-zinc-200 px-4" />
      </label>
      <label className="text-sm font-medium">
        使用機材
        <input name="equipmentText" defaultValue={report.equipmentText ?? ""} className="mt-1 w-full rounded-xl border border-zinc-200 px-4" />
      </label>
      <label className="text-sm font-medium">
        作業内容
        <textarea name="body" required defaultValue={report.body} className="mt-1 min-h-40 w-full rounded-xl border border-zinc-200 px-4 py-3" />
      </label>
      <label className="text-sm font-medium">
        進捗
        <textarea name="progressNote" defaultValue={report.progressNote ?? ""} className="mt-1 min-h-20 w-full rounded-xl border border-zinc-200 px-4 py-3" />
      </label>
      <label className="text-sm font-medium">
        問題点
        <textarea name="issues" defaultValue={report.issues ?? ""} className="mt-1 min-h-20 w-full rounded-xl border border-zinc-200 px-4 py-3" />
      </label>
      <label className="text-sm font-medium">
        安全事項
        <textarea name="safetyNotes" defaultValue={report.safetyNotes ?? ""} className="mt-1 min-h-20 w-full rounded-xl border border-zinc-200 px-4 py-3" />
      </label>
      <label className="text-sm font-medium">
        明日の予定
        <textarea name="tomorrowPlan" defaultValue={report.tomorrowPlan ?? ""} className="mt-1 min-h-20 w-full rounded-xl border border-zinc-200 px-4 py-3" />
      </label>
      <label className="text-sm font-medium">
        備考
        <textarea name="remarks" defaultValue={report.remarks ?? ""} className="mt-1 min-h-20 w-full rounded-xl border border-zinc-200 px-4 py-3" />
      </label>
      {photos.length > 0 ? (
        <fieldset>
          <legend className="text-sm font-medium">添付写真</legend>
          <ul className="mt-2 grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <li key={photo.id} className="rounded-2xl bg-zinc-50 p-2">
                <label className="flex flex-col gap-2 text-sm">
                  {photo.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.url} alt="" className="h-28 w-full rounded-xl object-cover" />
                  ) : null}
                  <span className="flex items-center gap-2">
                    <input type="checkbox" name="photoId" value={photo.id} defaultChecked={selected.has(photo.id)} />
                    日報に付ける
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-2xl border border-zinc-200 bg-white font-medium">
        {pending ? "保存中…" : "下書きを保存"}
      </button>
    </form>
  );
}
