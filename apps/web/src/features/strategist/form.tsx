"use client";

import { useActionState, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  confirmStrategistPhotosAction,
  confirmStrategistReportAction,
  confirmStrategistTasksAction,
  sendStrategistMessageAction,
  type StrategistChatState,
} from "@/features/strategist/actions";
import type { StrategistProposal } from "@/features/strategist/tools";

const QUICK = [
  { id: "today", label: "今日やること", hint: "帰る前の残り仕事" },
  { id: "risk", label: "遅延", hint: "工程と期限切れ" },
  { id: "similar", label: "類似現場", hint: "似た工事の教訓" },
  { id: "tasks", label: "タスク案", hint: "まだ作りません" },
] as const;

const TOOL_LABEL: Record<string, string> = {
  get_today_brief: "今日の要点",
  get_today_actions: "今日の行動",
  get_overdue_tasks: "期限切れ",
  get_open_tasks: "未完了タスク",
  get_delayed_processes: "遅れている工程",
  get_pending_items: "未確認",
  list_reports: "日報",
  list_today_photos: "今日の写真",
  list_unfiled_photos: "未分類の写真",
  get_recent_chat: "チャット",
  get_similar_projects: "類似現場",
  propose_daily_report_draft: "日報下書き案",
  propose_create_tasks: "タスク案",
  propose_photo_classify: "写真分類案",
};

function toolLabel(name: string) {
  return TOOL_LABEL[name] ?? name;
}

function ReportCard({ proposal }: { proposal: Extract<StrategistProposal, { kind: "report_draft" }> }) {
  const [state, action, pending] = useActionState(confirmStrategistReportAction, null);
  return (
    <form action={action} className="overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white">
      <input type="hidden" name="projectId" value={proposal.projectId} />
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-sm font-semibold text-amber-800">
          日
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-amber-800">確認が必要 · まだ作成していません</p>
          <p className="mt-1 text-sm font-semibold">日報の下書き</p>
          <p className="mt-1 text-sm text-zinc-600">
            {proposal.projectName}
            <span className="text-zinc-400"> — </span>
            {proposal.summary}
          </p>
          {state?.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
          {state?.ok ? <p className="mt-2 text-sm text-emerald-700">{state.ok}</p> : null}
          <button
            type="submit"
            disabled={pending || Boolean(state?.ok)}
            className="mt-3 rounded-xl bg-[var(--kb-ink)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? "作成中…" : state?.ok ? "作成済み" : "下書きを作成する"}
          </button>
        </div>
      </div>
    </form>
  );
}

function TasksCard({ proposal }: { proposal: Extract<StrategistProposal, { kind: "create_tasks" }> }) {
  const [state, action, pending] = useActionState(confirmStrategistTasksAction, null);
  return (
    <form action={action} className="overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white">
      <input type="hidden" name="projectId" value={proposal.projectId} />
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-sm font-semibold text-amber-800">
          タ
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-amber-800">確認が必要 · まだ追加していません</p>
          <p className="mt-1 text-sm font-semibold">タスクを追加（{proposal.projectName}）</p>
          <ul className="mt-3 flex flex-col gap-2">
            {proposal.titles.map((title) => (
              <li key={title}>
                <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl bg-white/80 px-3 py-2 ring-1 ring-zinc-100">
                  <input type="checkbox" name="titles" value={title} defaultChecked className="mt-1 h-4 w-4 accent-[var(--kb-ink)]" />
                  <span className="text-sm">{title}</span>
                </label>
              </li>
            ))}
          </ul>
          {state?.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
          {state?.ok ? <p className="mt-2 text-sm text-emerald-700">{state.ok}</p> : null}
          <button
            type="submit"
            disabled={pending || Boolean(state?.ok)}
            className="mt-3 rounded-xl bg-[var(--kb-ink)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? "作成中…" : state?.ok ? "追加済み" : "選んだタスクを追加"}
          </button>
        </div>
      </div>
    </form>
  );
}

function PhotosCard({ proposal }: { proposal: Extract<StrategistProposal, { kind: "photo_classify" }> }) {
  const [state, action, pending] = useActionState(confirmStrategistPhotosAction, null);
  return (
    <form action={action} className="overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white">
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-sm font-semibold text-amber-800">
          写
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-amber-800">確認が必要 · まだ確定しません</p>
          <p className="mt-1 text-sm font-semibold">写真の分類案</p>
          <ul className="mt-3 flex flex-col gap-2">
            {proposal.items.map((item) => (
              <li key={item.photoId} className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-2 text-sm ring-1 ring-zinc-100">
                <input type="hidden" name="photoIds" value={item.photoId} />
                <span className="min-w-0 truncate text-zinc-700">{item.label}</span>
                <a className="shrink-0 text-sm font-medium text-[var(--kb-amber)]" href={`/photos/${item.photoId}`}>
                  開く
                </a>
              </li>
            ))}
          </ul>
          {state?.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
          {state?.ok ? <p className="mt-2 text-sm text-emerald-700">{state.ok}</p> : null}
          <button
            type="submit"
            disabled={pending || Boolean(state?.ok)}
            className="mt-3 rounded-xl bg-[var(--kb-ink)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? "保存中…" : state?.ok ? "保存済み" : "分類案として保存"}
          </button>
        </div>
      </div>
    </form>
  );
}

function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
    return;
  }
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

export function StrategistForm({
  projectId,
  projects,
}: {
  projectId?: string;
  projects?: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(sendStrategistMessageAction, null as StrategistChatState | null);
  const formId = useId();
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? projects?.[0]?.id ?? "");
  const history = (state?.turns ?? []).map((item) => ({ role: item.role, content: item.content }));
  const embedded = Boolean(projectId) && !(projects && projects.length > 0);
  const empty = (state?.turns ?? []).length === 0 && !pending;
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [state?.turns, pending, state?.proposals]);

  return (
    <div
      className={
        embedded
          ? "flex flex-col gap-4"
          : "flex flex-col overflow-hidden rounded-[1.75rem] border border-[var(--kb-line)] bg-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)]"
      }
    >
      {projects && projects.length > 0 ? (
        <div className={embedded ? "" : "border-b border-zinc-100 px-4 py-3 sm:px-5"}>
          <label className="flex min-w-0 items-center gap-2 text-sm">
            <span className="shrink-0 text-zinc-500">現場</span>
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="min-h-11 w-full rounded-xl border-0 bg-zinc-50 px-3 text-sm font-medium outline-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-[var(--kb-ink)]"
            >
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div
        ref={scroller}
        className={
          embedded
            ? "flex max-h-[28rem] flex-col gap-3 overflow-y-auto"
            : "flex max-h-[min(32rem,58dvh)] min-h-[18rem] flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-5"
        }
      >
        {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {empty ? (
          <div className="flex flex-1 flex-col justify-center gap-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--kb-ink)] text-sm font-semibold text-white">
                軍
              </span>
              <div>
                <p className="text-sm font-semibold">現場の状況を聞いてください</p>
                <p className="text-sm text-zinc-500">読み取りはそのまま答えます。日報・タスク・写真分類は確認後だけ実行します。</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {QUICK.map((item) => (
                <button
                  key={item.id}
                  type="submit"
                  form={formId}
                  name="quick"
                  value={item.id}
                  disabled={pending}
                  className="rounded-2xl bg-zinc-50 px-4 py-3 text-left ring-1 ring-zinc-100 transition hover:bg-white hover:ring-zinc-200"
                >
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{item.hint}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {(state?.turns ?? []).map((turn, index) =>
              turn.role === "user" ? (
                <div key={`${turn.role}-${index}`} className="ml-8 flex justify-end sm:ml-16">
                  <div className="max-w-[min(100%,36rem)] rounded-2xl rounded-tr-md bg-[var(--kb-ink)] px-4 py-3 text-sm text-white">
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">{turn.content}</pre>
                  </div>
                </div>
              ) : (
                <div key={`${turn.role}-${index}`} className="mr-4 flex gap-3 sm:mr-12">
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--kb-ink)] text-[11px] font-semibold text-white">
                    軍
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-zinc-50 px-4 py-3 text-sm ring-1 ring-zinc-100">
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed text-zinc-800">{turn.content}</pre>
                    {turn.tools && turn.tools.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {turn.tools.map((item) => (
                          <span
                            key={`${item.name}-${item.ok}`}
                            className={
                              item.ok
                                ? "rounded-full bg-white px-2.5 py-1 text-[11px] text-zinc-600 ring-1 ring-zinc-200"
                                : "rounded-full bg-red-50 px-2.5 py-1 text-[11px] text-red-700 ring-1 ring-red-100"
                            }
                          >
                            {toolLabel(item.name)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ),
            )}
            {pending ? (
              <div className="mr-4 flex gap-3 sm:mr-12">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--kb-ink)] text-[11px] font-semibold text-white">
                  軍
                </span>
                <div className="rounded-2xl rounded-tl-md bg-zinc-50 px-4 py-3 text-sm text-zinc-500 ring-1 ring-zinc-100">
                  <span className="inline-flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400 [animation-delay:300ms]" />
                    </span>
                    現場データを調べています…
                  </span>
                </div>
              </div>
            ) : null}
            {(state?.proposals ?? []).map((proposal, index) => {
              if (proposal.kind === "report_draft") {
                return <ReportCard key={`r-${index}`} proposal={proposal} />;
              }
              if (proposal.kind === "create_tasks") {
                return <TasksCard key={`t-${index}`} proposal={proposal} />;
              }
              return <PhotosCard key={`p-${index}`} proposal={proposal} />;
            })}
          </>
        )}
      </div>

      <form
        id={formId}
        action={action}
        className={embedded ? "flex flex-col gap-2" : "border-t border-zinc-100 bg-white px-3 py-3 sm:px-4"}
      >
        <input type="hidden" name="history" value={JSON.stringify(history)} />
        <input type="hidden" name="projectId" value={selectedProjectId} />
        <div className="flex items-end gap-2">
          <textarea
            name="message"
            rows={2}
            placeholder="今日何をすればいい？期限切れは？日報を作って…"
            onKeyDown={onComposerKeyDown}
            className="min-h-[3.25rem] flex-1 resize-none rounded-2xl border-0 bg-zinc-50 px-4 py-3 text-sm leading-relaxed outline-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-[var(--kb-ink)]"
          />
          <button
            type="submit"
            disabled={pending}
            className="h-12 shrink-0 rounded-2xl bg-[var(--kb-ink)] px-5 text-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? "送信中" : "送信"}
          </button>
        </div>
        {!empty ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK.map((item) => (
              <button
                key={item.id}
                type="submit"
                name="quick"
                value={item.id}
                disabled={pending}
                className="h-9 min-h-9 rounded-full bg-zinc-50 px-3 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 disabled:opacity-40"
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-zinc-400">
          Enter で送信 / Shift+Enter で改行。削除・確定・課金はしません。
        </p>
      </form>
    </div>
  );
}
