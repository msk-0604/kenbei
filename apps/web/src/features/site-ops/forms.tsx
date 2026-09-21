"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TASK_STATUS_LABELS, PROCESS_STATUS_LABELS, PRIORITY_LABELS, TASK_QUICK_PRESETS, dueOnForChip } from "@kensapo/domain";
import {
  createProcessAction,
  createTaskAction,
  updateProcessAction,
  updateTaskStatusAction,
} from "@/features/site-ops/actions";
import type { ProcessRecord, TaskRecord } from "@/features/site-ops/queries";
import type { OrgMemberOption } from "@/features/projects/queries";
import { tokyoTodayIso } from "@/lib/dates";
import { FormSuccessNotice } from "@/components/action-notice";
import { TODAY_TASK_LABEL } from "@/features/today/today-cta";
import {
  taskStatusActionLabel,
  taskStatusButtonView,
  taskStatusSuccessMessage,
} from "@/features/site-ops/task-status-ui";
import { toUserActionError } from "@/lib/user-error";


export function CreateTaskForm({
  projectId,
  members = [],
  projects,
}: {
  projectId?: string;
  members?: OrgMemberOption[];
  projects?: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createTaskAction, null);
  const today = tokyoTodayIso();
  const [title, setTitle] = useState("");
  const [dueChip, setDueChip] = useState<"today" | "tomorrow" | "none">("today");
  const [more, setMore] = useState(false);
  const dueOn = dueOnForChip(dueChip, today);
  const resolvedProjectId = projectId ?? projects?.[0]?.id ?? "";

  if (!resolvedProjectId) {
    return <p className="text-sm text-zinc-500">現場があると、ここでタスクを追加できます。</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}
      <input type="hidden" name="dueOn" value={dueOn} />
      {projects && !projectId ? (
        <label className="text-sm font-medium">
          現場
          <select
            name="projectId"
            defaultValue={resolvedProjectId}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 text-base"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="flex flex-col gap-2">
        {TASK_QUICK_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setTitle(preset)}
            className={`kb-tap min-h-12 rounded-2xl px-4 text-left text-base ring-1 ${
              title === preset
                ? "bg-[var(--kb-ink)] text-white ring-[var(--kb-ink)]"
                : "bg-white text-[var(--kb-ink)] ring-[var(--kb-line)]"
            }`}
          >
            {preset}
          </button>
        ))}
      </div>
      <input
        name="title"
        required
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="またはタスク名を入力"
        className="min-h-12 rounded-xl border border-zinc-200 px-4 text-base"
      />
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["today", "今日"],
            ["tomorrow", "明日"],
            ["none", "期限なし"],
          ] as const
        ).map(([chip, label]) => (
          <button
            key={chip}
            type="button"
            onClick={() => setDueChip(chip)}
            className={`kb-tap min-h-12 rounded-2xl text-sm font-medium ring-1 ${
              dueChip === chip
                ? "bg-[var(--kb-ink)] text-white ring-[var(--kb-ink)]"
                : "bg-white text-[var(--kb-ink)] ring-[var(--kb-line)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setMore((open) => !open)}
        className="kb-tap min-h-12 rounded-2xl bg-[#f3eee6] px-4 text-sm font-medium text-zinc-700"
      >
        {more ? "詳細を閉じる" : "担当・説明（任意）"}
      </button>
      <div className={more ? "flex flex-col gap-3" : "hidden"}>
        <textarea name="description" placeholder="説明" className="min-h-20 rounded-xl border border-zinc-200 px-4 py-3" />
        {members.length > 0 ? (
          <select name="assigneeMembershipId" className="rounded-xl border border-zinc-200 px-3">
            <option value="">担当者</option>
            {members.map((member) => (
              <option key={member.membershipId} value={member.membershipId}>
                {member.displayName}
              </option>
            ))}
          </select>
        ) : null}
        <select name="priority" defaultValue="normal" className="rounded-xl border border-zinc-200 px-3">
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {state?.error ? (
        <p className="text-sm text-red-600">{toUserActionError(state.error, "作業を追加")}</p>
      ) : (
        <FormSuccessNotice pending={pending} error={state?.error} message="✓ 作業を追加しました" />
      )}
      <button type="submit" disabled={pending} className="kb-tap min-h-12 rounded-2xl bg-[var(--kb-ink)] font-medium text-white">
        {pending ? "追加中…" : TODAY_TASK_LABEL}
      </button>
    </form>
  );
}

export function TaskList({ tasks }: { tasks: TaskRecord[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-zinc-500">今日の作業はまだありません。下の欄から追加できます。</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <TaskStatusCard key={task.id} task={task} />
      ))}
    </ul>
  );
}

function TaskStatusCard({ task }: { task: TaskRecord }) {
  const router = useRouter();
  const [status, setStatus] = useState(task.status);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingStatus) {
      setStatus(task.status);
    }
  }, [task.status, pendingStatus]);

  function applyStatus(next: string) {
    if (pendingStatus || next === status) {
      return;
    }
    const previous = status;
    setStatus(next);
    setPendingStatus(next);
    setError(null);
    setSuccess(null);
    void updateTaskStatusAction(task.id, next, task.projectId).then((result) => {
      setPendingStatus(null);
      if (result?.error) {
        setStatus(previous);
        setError(toUserActionError(result.error, "タスクを更新"));
        return;
      }
      setSuccess(taskStatusSuccessMessage(next));
      window.setTimeout(() => {
        router.refresh();
      }, 700);
    });
  }

  return (
    <li
      className={`rounded-2xl px-4 py-3 ring-1 ${task.overdue && status !== "done" ? "bg-red-50 ring-red-200" : "bg-white ring-zinc-100"}`}
    >
      <p className="font-medium">{task.title}</p>
      <p className="mt-1 text-sm text-zinc-500">
        {TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS] ?? status}
        {pendingStatus ? " / 更新中…" : ""}
        {task.assigneeName ? ` / ${task.assigneeName}` : ""}
        {task.dueOn ? ` / ${task.dueOn}` : ""}
        {task.overdue && status !== "done" ? " / 期限超過" : ""}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => {
          const { selected, updating, disabled } = taskStatusButtonView(status, pendingStatus, value);
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-busy={updating}
              className={`kb-tap min-h-12 rounded-xl px-2 text-sm font-medium ring-1 disabled:opacity-70 ${
                selected
                  ? "bg-[var(--kb-ink)] text-white ring-[var(--kb-ink)]"
                  : "border-0 bg-white text-[var(--kb-ink)] ring-[var(--kb-line)]"
              }`}
              onClick={() => applyStatus(value)}
            >
              {updating ? "更新中…" : taskStatusActionLabel(value, label)}
            </button>
          );
        })}
        {success ? <p className="col-span-full text-sm font-medium text-emerald-800">{success}</p> : null}
        {error ? <p className="col-span-full text-sm text-red-600">{error}</p> : null}
      </div>
    </li>
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
