import Link from "next/link";
import { TASK_STATUS_LABELS } from "@kensapo/domain";
import { can } from "@/lib/authz-guard";
import type { Workspace } from "@/lib/session";
import { formatTokyoDate } from "@/lib/dates";
import { CompleteTaskButton } from "@/features/today/complete-task-button";
import { CreateTodayReportButton } from "@/features/reports/forms";
import { CreateTaskForm } from "@/features/site-ops/forms";
import type { TodayBoardProject, TodayOps } from "@/features/today/queries";
import type { TodayFocusTask } from "@/features/today/focus-tasks";
import { OnboardingChecklist } from "@/features/onboarding/checklist";
import type { OnboardingFlags } from "@kensapo/domain";
import { AppLink } from "@/components/app-nav";
import { EmptyGuide } from "@/components/empty-guide";
import { ActionNotice } from "@/components/action-notice";
import { RevealPanel } from "@/components/reveal-panel";
import { emptyWorkspaceCreateProjectHref } from "@/features/projects/routes";
import {
  TODAY_PHOTO_LABEL,
  TODAY_REPORT_DONE_LABEL,
  TODAY_REPORT_LABEL,
  TODAY_REPORT_REVIEW_LABEL,
  TODAY_TASK_ANCHOR,
  TODAY_TASK_LABEL,
  todayPhotoHref,
  todayReportHref,
  todayTaskHref,
} from "@/features/today/today-cta";

export function TodayView({
  workspace,
  projects,
  ops,
  pendingCaptureId,
  onboarding,
  signals,
  focusTasks,
  createdProject = false,
}: {
  workspace: Workspace;
  projects: TodayBoardProject[];
  ops: TodayOps;
  pendingCaptureId: string | null;
  onboarding: OnboardingFlags & { complete: boolean; firstProjectId?: string | null; hasReport?: boolean };
  signals: { id: string; title: string; reason: string }[];
  focusTasks: TodayFocusTask[];
  createdProject?: boolean;
}) {
  const canTask = can(workspace, "project.update") || can(workspace, "capture.create");
  const first = projects[0];
  const photoHref = todayPhotoHref(first?.projectId);
  const createProjectHref = emptyWorkspaceCreateProjectHref(can(workspace, "project.create"));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm text-zinc-500">{formatTokyoDate()}</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight">今日</h1>
      </header>

      {createdProject ? <ActionNotice>✓ 現場を作りました。次は写真を追加してください</ActionNotice> : null}

      {first ? (
        <div className="grid gap-2">
          <AppLink href={photoHref} className="w-full">
            {TODAY_PHOTO_LABEL}
          </AppLink>
          {canTask ? (
            <AppLink href={todayTaskHref()} variant="secondary" className="w-full">
              {TODAY_TASK_LABEL}
            </AppLink>
          ) : null}
          {first.reportId ? (
            <AppLink
              href={todayReportHref(first.reportId)}
              variant={first.reportStatus === "confirmed" ? "secondary" : "primary"}
              className="w-full"
            >
              {first.reportStatus === "confirmed" ? TODAY_REPORT_DONE_LABEL : TODAY_REPORT_REVIEW_LABEL}
            </AppLink>
          ) : (
            <CreateTodayReportButton projectId={first.projectId} label={TODAY_REPORT_LABEL} />
          )}
        </div>
      ) : (
        <EmptyGuide
          title="まだ現場がありません"
          body="まず現場を1件作りましょう。"
          action={createProjectHref ? <AppLink href={createProjectHref}>最初の現場を作る</AppLink> : undefined}
        />
      )}

      <section>
        <h2 className="text-lg font-semibold tracking-tight">今日の作業</h2>
        {focusTasks.length > 0 ? (
          <>
            <p className="mt-1 text-sm text-zinc-500">期限超過と、今日中の仕事です。</p>
            <ul className="mt-4 flex flex-col gap-3">
              {focusTasks.map((task) => (
                <li
                  key={task.id}
                  className={`rounded-2xl px-4 py-3 ring-1 ${
                    task.overdue ? "bg-red-50 ring-red-200" : "bg-white ring-[var(--kb-line)]"
                  }`}
                >
                  <p className="text-sm text-zinc-500">{task.projectName}</p>
                  <p className="mt-1 font-medium">{task.title}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {task.overdue ? "期限超過" : task.dueToday ? "今日期限" : "進行中"}
                    {task.dueOn ? ` / ${task.dueOn}` : ""}
                    {` / ${TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status}`}
                  </p>
                  {canTask ? (
                    <div className="mt-3">
                      <CompleteTaskButton taskId={task.id} projectId={task.projectId} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">今日の作業はありません。</p>
        )}
        {canTask && first ? (
          <div id={TODAY_TASK_ANCHOR} className="mt-4 scroll-mt-24">
            <RevealPanel label={TODAY_TASK_LABEL} openOnHash={TODAY_TASK_ANCHOR}>
              <CreateTaskForm projectId={first.projectId} />
            </RevealPanel>
          </div>
        ) : null}
      </section>

      <OnboardingChecklist
        flags={onboarding}
        complete={onboarding.complete}
        firstProjectId={onboarding.firstProjectId}
        hasReport={onboarding.hasReport}
      />

      {ops.overdueTaskCount > 0 || ops.delayedCount > 0 ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {ops.overdueTaskCount > 0 ? `期限超過 ${ops.overdueTaskCount}件` : null}
          {ops.overdueTaskCount > 0 && ops.delayedCount > 0 ? " / " : null}
          {ops.delayedCount > 0 ? `工程遅延 ${ops.delayedCount}件` : null}
        </p>
      ) : null}

      {pendingCaptureId ? (
        <Link
          href={`/captures/${pendingCaptureId}/confirm`}
          className="kb-tap rounded-2xl bg-amber-50 px-4 py-3 text-base font-medium text-amber-950 ring-1 ring-amber-200"
        >
          音声報告の確認が残っています
        </Link>
      ) : null}

      {signals.length > 0 ? (
        <section className="rounded-3xl bg-[var(--kb-card)] p-5 ring-1 ring-[var(--kb-line)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">今日注意すべきこと</h2>
            <Link href="/strategist" className="text-sm font-medium text-[var(--kb-amber)]">
              AIに相談
            </Link>
          </div>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {signals.map((item) => (
              <li key={item.id} className="rounded-2xl bg-zinc-50 px-4 py-3">
                <p className="font-medium">{item.title}</p>
                <p className="text-zinc-600">{item.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {projects.map((project) => (
        <section key={project.projectId} className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">{project.projectName}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {project.reportStatus === "confirmed" ? "日報済み" : "日報はまだ"}
              {project.overdueTaskCount > 0 ? ` · 期限超過 ${project.overdueTaskCount}` : ""}
            </p>
          </div>
          <AppLink href={`/projects/${project.projectId}`} variant="ghost" className="min-h-10 justify-start px-0 text-sm">
            現場を見る
          </AppLink>
        </section>
      ))}
    </div>
  );
}
