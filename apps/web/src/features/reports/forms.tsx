"use client";

import { useActionState, useMemo, useState } from "react";
import {
  REPORT_SAFETY_NOTE_PRESET,
  REPORT_SAFETY_PRESETS,
  REPORT_WEATHER_OPTIONS,
  appendReportLine,
  formatSafetyNotes,
  openTaskTitles,
  parseSafetyNotes,
  weatherTextForStorage,
  workCandidatesFromTasks,
} from "@kensapo/domain";
import { confirmReportAction, createTodayReportDraftAction, saveReportAction } from "@/features/reports/actions";
import type { DailyReportRecord } from "@/features/reports/queries";
import type { PhotoRecord } from "@/features/photos/queries";

export function CreateTodayReportButton({
  projectId,
  variant = "primary",
}: {
  projectId: string;
  variant?: "primary" | "secondary";
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const look =
    variant === "secondary"
      ? "border border-[var(--kb-line)] bg-white text-[var(--kb-ink)] hover:bg-zinc-50"
      : "bg-[var(--kb-ink)] text-white hover:bg-zinc-800";
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        className={`kb-tap min-h-12 w-full rounded-2xl font-medium disabled:opacity-60 ${look}`}
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
        className="rounded-2xl bg-[var(--kb-ink)] font-medium text-white disabled:opacity-40 kb-tap min-h-12"
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
  tasks,
}: {
  report: DailyReportRecord;
  photos: PhotoRecord[];
  tasks: { title: string; status: string }[];
}) {
  const [state, action, pending] = useActionState(saveReportAction, null);
  const [weather, setWeather] = useState(() => weatherTextForStorage(report.weather));
  const [body, setBody] = useState(report.body);
  const [tomorrowPlan, setTomorrowPlan] = useState(report.tomorrowPlan ?? "");
  const initialSafety = useMemo(() => parseSafetyNotes(report.safetyNotes), [report.safetyNotes]);
  const [safetySelected, setSafetySelected] = useState<string[]>(initialSafety.selected);
  const [safetyExtra, setSafetyExtra] = useState(initialSafety.extra);
  const [photoIds, setPhotoIds] = useState(() => new Set(report.photoIds));
  const [moreOpen, setMoreOpen] = useState(false);
  const workChips = workCandidatesFromTasks(tasks);
  const tomorrowChips = openTaskTitles(tasks);
  const safetyNotes = formatSafetyNotes(safetySelected, safetyExtra);
  const needsSafetyNote = safetySelected.includes(REPORT_SAFETY_NOTE_PRESET);

  function toggleSafety(label: string) {
    setSafetySelected((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    );
  }

  function togglePhoto(id: string) {
    setPhotoIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="reportId" value={report.id} />
      <input type="hidden" name="weather" value={weather} />
      <input type="hidden" name="safetyNotes" value={safetyNotes} />
      {[...photoIds].map((id) => (
        <input key={id} type="hidden" name="photoId" value={id} />
      ))}

      <section>
        <h2 className="text-sm font-medium">天候</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {REPORT_WEATHER_OPTIONS.map((option) => {
            const on = weather === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={on}
                onClick={() => setWeather(option.value)}
                className={`kb-tap min-h-12 rounded-2xl px-3 text-base font-medium ring-1 ${
                  on
                    ? "bg-[var(--kb-ink)] text-white ring-[var(--kb-ink)]"
                    : "bg-white text-[var(--kb-ink)] ring-[var(--kb-line)]"
                }`}
              >
                <span aria-hidden className="mr-1">
                  {option.emoji}
                </span>
                {option.value}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium">今日の作業</h2>
        <p className="mt-1 text-sm text-zinc-500">現場のタスクをタップすると作業内容に足します。</p>
        <div className="mt-2 flex flex-col gap-2">
          {workChips.map((chip, index) => (
            <button
              key={`${chip.title}-${index}`}
              type="button"
              onClick={() => setBody((current) => appendReportLine(current, chip.title))}
              className="kb-tap min-h-12 rounded-2xl bg-white px-4 text-left text-base ring-1 ring-[var(--kb-line)]"
            >
              {chip.done ? "完了 · " : ""}
              {chip.title}
            </button>
          ))}
        </div>
        <label className="mt-3 block text-sm font-medium">
          作業内容
          <textarea
            name="body"
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="mt-1 min-h-28 w-full rounded-xl border border-zinc-200 px-4 py-3 text-base"
          />
        </label>
      </section>

      <section>
        <h2 className="text-sm font-medium">今日の写真 {photos.length}枚</h2>
        {photos.length > 0 ? (
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {photos.map((photo) => {
              const on = photoIds.has(photo.id);
              return (
                <li key={photo.id}>
                  <button
                    type="button"
                    onClick={() => togglePhoto(photo.id)}
                    className={`block w-full overflow-hidden rounded-2xl ring-2 ${
                      on ? "ring-[var(--kb-ink)]" : "ring-transparent"
                    }`}
                  >
                    {photo.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo.url} alt="" className="h-24 w-full object-cover" />
                    ) : (
                      <div className="flex h-24 items-center justify-center bg-zinc-100 text-xs text-zinc-400">画像なし</div>
                    )}
                    <span className="block bg-white py-1 text-center text-xs">{on ? "添付中" : "付ける"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">当日の写真はありません。黒板付きで上げた写真はここに出ます。</p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium">安全</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {REPORT_SAFETY_PRESETS.map((label) => {
            const on = safetySelected.includes(label);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() => toggleSafety(label)}
                className={`kb-tap min-h-12 rounded-2xl px-3 text-sm font-medium ring-1 ${
                  on
                    ? "bg-[var(--kb-ink)] text-white ring-[var(--kb-ink)]"
                    : "bg-white text-[var(--kb-ink)] ring-[var(--kb-line)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {needsSafetyNote ? (
          <textarea
            value={safetyExtra}
            onChange={(event) => setSafetyExtra(event.target.value)}
            placeholder="注意したこと"
            className="mt-3 min-h-20 w-full rounded-xl border border-zinc-200 px-4 py-3 text-base"
          />
        ) : null}
      </section>

      <section>
        <h2 className="text-sm font-medium">明日の予定</h2>
        {tomorrowChips.length > 0 ? (
          <div className="mt-2 flex flex-col gap-2">
            {tomorrowChips.map((title, index) => (
              <button
                key={`${title}-${index}`}
                type="button"
                onClick={() => setTomorrowPlan((current) => appendReportLine(current, title))}
                className="kb-tap min-h-12 rounded-2xl bg-white px-4 text-left text-base ring-1 ring-[var(--kb-line)]"
              >
                明日の予定に追加 · {title}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">未完了タスクはありません。必要なら下に書けます。</p>
        )}
        <textarea
          name="tomorrowPlan"
          value={tomorrowPlan}
          onChange={(event) => setTomorrowPlan(event.target.value)}
          className="mt-3 min-h-20 w-full rounded-xl border border-zinc-200 px-4 py-3 text-base"
        />
      </section>

      <button
        type="button"
        onClick={() => setMoreOpen((open) => !open)}
        className="kb-tap min-h-12 rounded-2xl bg-[#f3eee6] px-4 text-sm font-medium text-zinc-700"
      >
        {moreOpen ? "その他を閉じる" : "人数・箇所など（任意）"}
      </button>
      <div className={moreOpen ? "flex flex-col gap-3" : "hidden"}>
          <label className="text-sm font-medium">
            作業箇所
            <input
              name="workLocation"
              defaultValue={report.workLocation ?? ""}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-4"
            />
          </label>
          <label className="text-sm font-medium">
            作業人数
            <input
              name="workerCount"
              type="number"
              inputMode="numeric"
              defaultValue={report.workerCount == null ? "" : String(report.workerCount)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-4"
            />
          </label>
          <label className="text-sm font-medium">
            協力会社
            <input
              name="partnerCompaniesText"
              defaultValue={report.partnerCompaniesText ?? ""}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-4"
            />
          </label>
          <label className="text-sm font-medium">
            使用機材
            <input
              name="equipmentText"
              defaultValue={report.equipmentText ?? ""}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-4"
            />
          </label>
          <label className="text-sm font-medium">
            進捗
            <textarea
              name="progressNote"
              defaultValue={report.progressNote ?? ""}
              className="mt-1 min-h-20 w-full rounded-xl border border-zinc-200 px-4 py-3"
            />
          </label>
          <label className="text-sm font-medium">
            問題点
            <textarea
              name="issues"
              defaultValue={report.issues ?? ""}
              className="mt-1 min-h-20 w-full rounded-xl border border-zinc-200 px-4 py-3"
            />
          </label>
          <label className="text-sm font-medium">
            備考
            <textarea
              name="remarks"
              defaultValue={report.remarks ?? ""}
              className="mt-1 min-h-20 w-full rounded-xl border border-zinc-200 px-4 py-3"
            />
          </label>
        </div>

      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="kb-tap min-h-12 rounded-2xl bg-[var(--kb-ink)] font-medium text-white disabled:opacity-60">
        {pending ? "保存中…" : "下書きを保存"}
      </button>
    </form>
  );
}
