import Link from "next/link";
import { TASK_STATUS_LABELS } from "@kensapo/domain";
import { AppShell } from "@/components/app-shell";
import { EmptyGuide } from "@/components/empty-guide";
import { AppLink } from "@/components/app-nav";
import { listOpenTasks } from "@/features/site-ops/queries";
import { CompleteTaskButton } from "@/features/today/complete-task-button";
import { can, requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const workspace = await requireWorkspace();
  const tasks = await listOpenTasks();
  const canComplete = can(workspace, "project.update") || can(workspace, "capture.create");

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">タスク</h1>
      <p className="mt-2 text-sm text-zinc-500">未完了だけを出しています。完了は1回です。</p>
      <ul className="mt-6 flex flex-col gap-3">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={`rounded-3xl px-4 py-4 ring-1 ${
              task.overdue ? "bg-red-50 ring-red-200" : "bg-white ring-zinc-100"
            }`}
          >
            <Link href={`/projects/${task.projectId}?tab=tasks`} className="text-sm text-zinc-500 underline">
              {task.projectName}
            </Link>
            <p className="mt-1 font-medium">{task.title}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status}
              {task.assigneeName ? ` / ${task.assigneeName}` : ""}
              {task.dueOn ? ` / ${task.dueOn}` : ""}
              {task.overdue ? " / 期限超過" : ""}
            </p>
            {canComplete && task.status !== "done" ? (
              <div className="mt-3">
                <CompleteTaskButton taskId={task.id} projectId={task.projectId} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {tasks.length === 0 ? (
        <EmptyGuide
          title="未完了のタスクはありません"
          body="写真から残作業を登録すると、Todayでまとめて確認できます。"
          action={<AppLink href="/photos">写真を見る</AppLink>}
        />
      ) : null}
    </AppShell>
  );
}
