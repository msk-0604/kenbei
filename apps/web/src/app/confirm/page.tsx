import type { ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AcceptAllProposedButton } from "@/features/photos/accept-all-button";
import { listDraftReports } from "@/features/reports/queries";
import { listProposedPhotos } from "@/features/photos/queries";
import { listDelayedProcesses, listOpenTasks } from "@/features/site-ops/queries";
import { latestPendingCaptureId } from "@/features/today/queries";
import { listUnreadNotifications } from "@/lib/notifications";
import { requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function ConfirmInboxPage() {
  const workspace = await requireWorkspace();
  const [drafts, photos, tasks, delayed, pendingCaptureId, notifications] = await Promise.all([
    listDraftReports(),
    listProposedPhotos(),
    listOpenTasks(),
    listDelayedProcesses(),
    latestPendingCaptureId(workspace),
    listUnreadNotifications(workspace),
  ]);
  const overdue = tasks.filter((task) => task.overdue);
  const review = tasks.filter((task) => task.status === "review");

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">確認</h1>
      <p className="mt-2 text-base text-zinc-600">今日見るものだけをここにまとめています。</p>
      <div className="mt-4">
        <AcceptAllProposedButton count={photos.length} />
      </div>

      {notifications.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-medium">お知らせ</h2>
          <ul className="flex flex-col gap-2">
            {notifications.map((item) => (
              <li key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-zinc-100">
                {item.href ? (
                  <Link href={item.href} className="font-medium">
                    {item.title}
                  </Link>
                ) : (
                  <p className="font-medium">{item.title}</p>
                )}
                {item.body ? <p className="mt-1 text-sm text-zinc-500">{item.body}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pendingCaptureId ? (
        <Link
          href={`/captures/${pendingCaptureId}/confirm`}
          className="mt-6 block rounded-2xl bg-amber-50 px-4 py-3 font-medium text-amber-950 ring-1 ring-amber-200"
        >
          音声報告の確認が残っています
        </Link>
      ) : null}

      <InboxGroup title="未確認日報" empty="下書きの日報はありません。">
        {drafts.map((report) => (
          <Link key={report.id} href={`/reports/${report.id}`} className="block rounded-2xl bg-white p-4 ring-1 ring-zinc-100">
            <p className="font-medium">{report.projectName}</p>
            <p className="text-sm text-zinc-500">{report.workOn} の下書き</p>
          </Link>
        ))}
      </InboxGroup>

      <InboxGroup title="写真の自動整理" empty="確認する写真はありません。">
        {photos.map((photo) => (
          <Link key={photo.id} href={`/photos/${photo.id}`} className="block rounded-2xl bg-white p-4 ring-1 ring-zinc-100">
            <p className="font-medium">{photo.projectName ?? "現場未設定"}</p>
            <p className="text-sm text-zinc-500">
              {photo.proposedWorkTypeKey ?? "工種未設定"} {photo.proposedLocationSpot ?? ""}
            </p>
          </Link>
        ))}
      </InboxGroup>

      <InboxGroup title="期限超過タスク" empty="期限超過はありません。">
        {overdue.map((task) => (
          <Link
            key={task.id}
            href={`/projects/${task.projectId}?tab=tasks`}
            className="block rounded-2xl bg-red-50 p-4 ring-1 ring-red-200"
          >
            <p className="font-medium">{task.title}</p>
            <p className="text-sm text-red-800">
              {task.projectName} / {task.dueOn}
            </p>
          </Link>
        ))}
      </InboxGroup>

      <InboxGroup title="確認待ちタスク" empty="確認待ちタスクはありません。">
        {review.map((task) => (
          <Link key={task.id} href={`/projects/${task.projectId}?tab=tasks`} className="block rounded-2xl bg-white p-4 ring-1 ring-zinc-100">
            <p className="font-medium">{task.title}</p>
            <p className="text-sm text-zinc-500">{task.projectName}</p>
          </Link>
        ))}
      </InboxGroup>

      <InboxGroup title="進捗遅延" empty="遅延している工程はありません。">
        {delayed.map((process) => (
          <Link
            key={process.id}
            href={`/projects/${process.projectId}?tab=schedule`}
            className="block rounded-2xl bg-red-50 p-4 ring-1 ring-red-200"
          >
            <p className="font-medium">{process.name}</p>
            <p className="text-sm text-red-800">
              {process.projectName} / 予定終了 {process.plannedEndOn}
            </p>
          </Link>
        ))}
      </InboxGroup>
    </AppShell>
  );
}

function InboxGroup({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  const items = Array.isArray(children) ? children : children ? [children] : [];
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-medium">{title}</h2>
      {items.length === 0 ? <p className="text-sm text-zinc-500">{empty}</p> : <div className="flex flex-col gap-2">{children}</div>}
    </section>
  );
}
