"use client";

import { useActionState } from "react";
import { createProposedTasksAction } from "@/features/site-ops/actions";

export function ProposeTasksForm({ projectId, titles }: { projectId: string; titles: string[] }) {
  const [state, action, pending] = useActionState(createProposedTasksAction, null);
  return (
    <form action={action} className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <input type="hidden" name="projectId" value={projectId} />
      <p className="text-sm font-medium">提案タスク（チェックした行だけ作成します）</p>
      <ul className="mt-3 flex flex-col gap-2">
        {titles.map((title) => (
          <li key={title}>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="titles" value={title} className="mt-1" />
              <span>{title}</span>
            </label>
          </li>
        ))}
      </ul>
      {state && "error" in state && state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
      {state && "created" in state ? <p className="mt-2 text-sm">作成しました（{state.created}件）</p> : null}
      <button type="submit" disabled={pending} className="mt-3 rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
        {pending ? "作成中…" : "選んだタスクを追加"}
      </button>
    </form>
  );
}
