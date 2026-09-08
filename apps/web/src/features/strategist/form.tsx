"use client";

import { useActionState } from "react";
import {
  confirmStrategistPhotosAction,
  confirmStrategistReportAction,
  confirmStrategistTasksAction,
  sendStrategistMessageAction,
  type StrategistChatState,
} from "@/features/strategist/actions";
import type { StrategistProposal } from "@/features/strategist/tools";

const QUICK = [
  { id: "today", label: "今日やること" },
  { id: "risk", label: "遅延" },
  { id: "similar", label: "類似現場" },
  { id: "tasks", label: "タスク案" },
] as const;

function ReportCard({ proposal }: { proposal: Extract<StrategistProposal, { kind: "report_draft" }> }) {
  const [state, action, pending] = useActionState(confirmStrategistReportAction, null);
  return (
    <form action={action} className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <input type="hidden" name="projectId" value={proposal.projectId} />
      <p className="text-sm font-medium">日報下書きの確認（まだ作成していません）</p>
      <p className="mt-1 text-sm text-zinc-600">
        {proposal.projectName} — {proposal.summary}
      </p>
      {state?.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
      {state?.ok ? <p className="mt-2 text-sm">{state.ok}</p> : null}
      <button type="submit" disabled={pending} className="mt-3 rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
        {pending ? "作成中…" : "下書きを作成する"}
      </button>
    </form>
  );
}

function TasksCard({ proposal }: { proposal: Extract<StrategistProposal, { kind: "create_tasks" }> }) {
  const [state, action, pending] = useActionState(confirmStrategistTasksAction, null);
  return (
    <form action={action} className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <input type="hidden" name="projectId" value={proposal.projectId} />
      <p className="text-sm font-medium">タスク作成の確認（{proposal.projectName}）</p>
      <ul className="mt-3 flex flex-col gap-2">
        {proposal.titles.map((title) => (
          <li key={title}>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="titles" value={title} defaultChecked className="mt-1" />
              <span>{title}</span>
            </label>
          </li>
        ))}
      </ul>
      {state?.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
      {state?.ok ? <p className="mt-2 text-sm">{state.ok}</p> : null}
      <button type="submit" disabled={pending} className="mt-3 rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
        {pending ? "作成中…" : "選んだタスクを追加"}
      </button>
    </form>
  );
}

function PhotosCard({ proposal }: { proposal: Extract<StrategistProposal, { kind: "photo_classify" }> }) {
  const [state, action, pending] = useActionState(confirmStrategistPhotosAction, null);
  return (
    <form action={action} className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <p className="text-sm font-medium">写真分類案の確認（まだ確定しません）</p>
      <ul className="mt-3 flex flex-col gap-2">
        {proposal.items.map((item) => (
          <li key={item.photoId} className="text-sm">
            <input type="hidden" name="photoIds" value={item.photoId} />
            <a className="underline" href={`/photos/${item.photoId}`}>
              写真
            </a>
            ：{item.label}
          </li>
        ))}
      </ul>
      {state?.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
      {state?.ok ? <p className="mt-2 text-sm">{state.ok}</p> : null}
      <button type="submit" disabled={pending} className="mt-3 rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
        {pending ? "保存中…" : "分類案として保存"}
      </button>
    </form>
  );
}

export function StrategistForm({
  projectId,
  projects,
}: {
  projectId?: string;
  projects?: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(sendStrategistMessageAction, null as StrategistChatState | null);
  const history = (state?.turns ?? []).map((item) => ({ role: item.role, content: item.content }));
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3">
        {projects && projects.length > 0 ? (
          <label className="text-sm font-medium">
            現場
            <select
              name="projectId"
              defaultValue={projectId ?? projects[0]?.id}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3"
            >
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : projectId ? (
          <input type="hidden" name="projectId" value={projectId} />
        ) : null}
        <input type="hidden" name="history" value={JSON.stringify(history)} />
        <label className="text-sm font-medium">
          軍師に聞く
          <textarea
            name="message"
            rows={3}
            placeholder="例：今日何をすればいい？期限切れは？今日の日報を作って"
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((item) => (
            <button
              key={item.id}
              type="submit"
              name="quick"
              value={item.id}
              disabled={pending}
              className="rounded-full bg-zinc-100 px-3 py-1 text-xs"
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">読み取りはそのまま答えます。日報・タスク・写真分類は確認後だけ実行します。削除・確定・課金はしません。</p>
        <button type="submit" disabled={pending} className="rounded-2xl bg-zinc-900 py-3 font-medium text-white">
          {pending ? "調べています…" : "送信"}
        </button>
      </form>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <div className="flex flex-col gap-3">
        {(state?.turns ?? []).map((turn, index) => (
          <div
            key={`${turn.role}-${index}`}
            className={turn.role === "user" ? "rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-white" : "rounded-2xl bg-white p-4 text-sm ring-1 ring-zinc-100"}
          >
            <p className="text-xs opacity-60">{turn.role === "user" ? "あなた" : "AI軍師"}</p>
            <pre className="mt-1 whitespace-pre-wrap font-sans">{turn.content}</pre>
            {turn.tools && turn.tools.length > 0 ? (
              <p className="mt-2 text-xs text-zinc-500">参照: {turn.tools.map((item) => item.name).join(" / ")}</p>
            ) : null}
          </div>
        ))}
      </div>
      {(state?.proposals ?? []).map((proposal, index) => {
        if (proposal.kind === "report_draft") {
          return <ReportCard key={`r-${index}`} proposal={proposal} />;
        }
        if (proposal.kind === "create_tasks") {
          return <TasksCard key={`t-${index}`} proposal={proposal} />;
        }
        return <PhotosCard key={`p-${index}`} proposal={proposal} />;
      })}
    </div>
  );
}
