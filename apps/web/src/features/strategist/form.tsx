"use client";

import { useActionState } from "react";
import { askStrategistAction, type StrategistState } from "@/features/strategist/actions";
import { ProposeTasksForm } from "@/features/strategist/propose-tasks";

const OPTIONS = [
  { id: "today", label: "今日何したらいい？" },
  { id: "project", label: "現場要約" },
  { id: "weekly", label: "週次要約" },
  { id: "chat", label: "Chat要約" },
  { id: "risk", label: "遅延リスク" },
  { id: "similar", label: "類似現場" },
  { id: "tasks", label: "Task提案" },
] as const;

export function StrategistForm({
  projectId,
  projects,
}: {
  projectId?: string;
  projects?: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(askStrategistAction, null as StrategistState | null);
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
        <label className="text-sm font-medium">
          聞くこと
          <select name="intent" defaultValue="today" className="mt-1 w-full rounded-xl border border-zinc-200 px-3">
            {OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-zinc-500">AIは下書きと提案だけです。確定・削除・課金は人が行います。</p>
        <button type="submit" disabled={pending} className="rounded-2xl bg-zinc-900 py-3 font-medium text-white">
          {pending ? "考え中…" : "軍師に聞く"}
        </button>
      </form>
      {state?.answer ? (
        <pre className="whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm ring-1 ring-zinc-100">{state.answer}</pre>
      ) : null}
      {state?.proposedTasks && state.proposedTasks.length > 0 ? (
        state.projectId ? (
          <ProposeTasksForm projectId={state.projectId} titles={state.proposedTasks} />
        ) : (
          <p className="text-sm text-zinc-500">タスク提案を追加するには現場を選んでください。</p>
        )
      ) : null}
    </div>
  );
}
