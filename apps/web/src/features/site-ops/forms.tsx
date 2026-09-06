"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { TASK_STATUS_LABELS, PROCESS_STATUS_LABELS, PRIORITY_LABELS } from "@kensapo/domain";
import {
  createProcessAction,
  createTaskAction,
  updateProcessAction,
  updateTaskStatusAction,
} from "@/features/site-ops/actions";
import type { ProcessRecord, TaskRecord } from "@/features/site-ops/queries";
import type { OrgMemberOption } from "@/features/projects/queries";

export function CreateTaskForm({
  projectId,
  members,
}: {
  projectId: string;
  members: OrgMemberOption[];
}) {
  const [state, action, pending] = useActionState(createTaskAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input name="title" required placeholder="タスク名" className="rounded-xl border border-zinc-200 px-4" />
      <textarea name="description" placeholder="説明" className="min-h-20 rounded-xl border border-zinc-200 px-4 py-3" />
      <select name="assigneeMembershipId" className="rounded-xl border border-zinc-200 px-3">
        <option value="">担当者</option>
        {members.map((member) => (
          <option key={member.membershipId} value={member.membershipId}>
            {member.displayName}
          </option>
        ))}
      </select>
      <input type="date" name="dueOn" className="rounded-xl border border-zinc-200 px-3" />
      <select name="priority" defaultValue="normal" className="rounded-xl border border-zinc-200 px-3">
        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-2xl bg-zinc-900 font-medium text-white">
        {pending ? "追加中…" : "タスクを追加"}
      </button>
    </form>
  );
}

export function TaskList({ tasks }: { tasks: TaskRecord[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-zinc-500">未完了のタスクはありません。</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li
          key={task.id}
          className={`rounded-2xl px-4 py-3 ring-1 ${task.overdue ? "bg-red-50 ring-red-200" : "bg-white ring-zinc-100"}`}
        >
          <p className="font-medium">{task.title}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status}
            {task.assigneeName ? ` / ${task.assigneeName}` : ""}
            {task.dueOn ? ` / ${task.dueOn}` : ""}
            {task.overdue ? " / 期限超過" : ""}
          </p>
          <TaskStatusButtons task={task} />
        </li>
      ))}
    </ul>
  );
}

function TaskStatusButtons({ task }: { task: TaskRecord }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {Object.entries(TASK_STATUS_LABELS).map(([status, label]) => (
        <button
          key={status}
          type="button"
          disabled={task.status === status}
          className="rounded-xl border border-zinc-200 bg-white text-sm disabled:opacity-40"
          onClick={() => {
            void updateTaskStatusAction(task.id, status, task.projectId).then((result) => {
              setError(result?.error ?? null);
              if (!result?.error) {
                router.refresh();
              }
            });
          }}
        >
          {label}
        </button>
      ))}
      {error ? <p className="col-span-full text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function CreateProcessForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(createProcessAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input name="name" required placeholder="工程名（例: 配管）" className="rounded-xl border border-zinc-200 px-4" />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-zinc-600">
          予定開始
          <input type="date" name="plannedStartOn" className="mt-1 w-full rounded-xl border border-zinc-200 px-3" />
        </label>
        <label className="text-sm text-zinc-600">
          予定終了
          <input type="date" name="plannedEndOn" className="mt-1 w-full rounded-xl border border-zinc-200 px-3" />
        </label>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-2xl bg-zinc-900 font-medium text-white">
        {pending ? "追加中…" : "工程を追加"}
      </button>
    </form>
  );
}

export function ProcessList({ processes, projectId }: { processes: ProcessRecord[]; projectId: string }) {
  if (processes.length === 0) {
    return <p className="text-sm text-zinc-500">工程はまだありません。</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {processes.map((process) => (
        <li
          key={process.id}
          className={`rounded-3xl p-4 ring-1 ${process.delayed ? "bg-red-50 ring-red-200" : "bg-white ring-zinc-100"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">{process.name}</p>
            {process.delayed ? <span className="text-sm font-medium text-red-700">遅延</span> : null}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {PROCESS_STATUS_LABELS[process.status as keyof typeof PROCESS_STATUS_LABELS] ?? process.status} / {process.percent}%
          </p>
          <ProcessUpdateForm process={process} projectId={projectId} />
        </li>
      ))}
    </ul>
  );
}

function ProcessUpdateForm({ process, projectId }: { process: ProcessRecord; projectId: string }) {
  const [state, action, pending] = useActionState(updateProcessAction, null);
  return (
    <form action={action} className="mt-3 grid grid-cols-2 gap-2">
      <input type="hidden" name="processId" value={process.id} />
      <input type="hidden" name="projectId" value={projectId} />
      <input
        name="percent"
        type="number"
        min={0}
        max={100}
        defaultValue={process.percent}
        className="rounded-xl border border-zinc-200 px-3"
      />
      <select name="status" defaultValue={process.status} className="rounded-xl border border-zinc-200 px-3">
        {Object.entries(PROCESS_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <input type="date" name="actualStartOn" defaultValue={process.actualStartOn ?? ""} className="rounded-xl border border-zinc-200 px-3" />
      <input type="date" name="actualEndOn" defaultValue={process.actualEndOn ?? ""} className="rounded-xl border border-zinc-200 px-3" />
      {state?.error ? <p className="col-span-2 text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="col-span-2 rounded-2xl border border-zinc-200 bg-white font-medium">
        {pending ? "更新中…" : "進捗を保存"}
      </button>
    </form>
  );
}
