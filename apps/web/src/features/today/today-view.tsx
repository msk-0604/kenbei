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
import { InstallHint } from "@/components/install-hint";
import { emptyWorkspaceCreateProjectHref } from "@/features/projects/routes";
import {
  TODAY_REPORT_DONE_LABEL,
  TODAY_REPORT_LABEL,
  TODAY_REPORT_REVIEW_LABEL,
  TODAY_TASK_ANCHOR,
  TODAY_TASK_LABEL,
  todayPhotoHref,
  todayReportHref,
  todaySteps,
  type TodayStepKey,
} from "@/features/today/today-cta";

const TASKS_ANCHOR = "today-tasks";

export function TodayView({
  workspace,
  projects,
  ops,
  pendingCaptureId,
  onboarding,
  focusTasks,
  selectedProjectId,
  createdProject = false,
}: {
  workspace: Workspace;
  projects: TodayBoardProject[];
  ops: TodayOps;
  pendingCaptureId: string | null;
  onboarding: OnboardingFlags & { complete: boolean; firstProjectId?: string | null; hasReport?: boolean };
  focusTasks: TodayFocusTask[];
  selectedProjectId?: string | null;
  createdProject?: boolean;
}) {
  const canTask = can(workspace, "project.update") || can(workspace, "capture.create");
  const current = projects.find((project) => project.projectId === selectedProjectId) ?? projects[0];
  const createProjectHref = emptyWorkspaceCreateProjectHref(can(workspace, "project.create"));
  const projectTasks = current ? focusTasks.filter((task) => task.projectId === current.projectId) : [];
  const otherTasks = current ? focusTasks.filter((task) => task.projectId !== current.projectId) : focusTasks;
  const { steps, next } = current
    ? todaySteps({
        photoCount: current.photoCount,
        openFocusTaskCount: projectTasks.length,
        reportStatus: current.reportStatus,
      })
    : { steps: [], next: null };
  const alertCount =
    (ops.overdueTaskCount > 0 ? 1 : 0) + (ops.delayedCount > 0 ? 1 : 0) + (pendingCaptureId ? 1 : 0);

  return (
    <div className="flex flex-col gap-7">
      <header>
        <p className="text-sm text-zinc-500">{formatTokyoDate()}</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight">今日やること</h1>
      </header>

      {createdProject ? <ActionNotice>✓ 現場を作りました。次は写真を撮りましょう</ActionNotice> : null}

      {current ? (
        <section className="flex flex-col gap-3">
          {projects.length > 1 ? (
            <nav aria-label="現場を選ぶ" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
              {projects.map((project) => {
                const active = project.projectId === current.projectId;
                return (
                  <Link
                    key={project.projectId}
                    href={`/?project=${project.projectId}`}
                    aria-current={active ? "true" : undefined}
                    className={`kb-tap inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium ${
                      active ? "bg-[var(--kb-ink)] text-white" : "bg-white text-zinc-700 ring-1 ring-[var(--kb-line)]"
                    }`}
                  >
                    {project.projectName}
                    {project.reportStatus === "confirmed" ? <span aria-label="日報済み">✓</span> : null}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          <article className="kb-elev rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)] md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-zinc-500">今日の現場</p>
                <h2 className="mt-0.5 truncate text-xl font-semibold tracking-tight">{current.projectName}</h2>
              </div>
              <Link
                href={`/projects/${current.projectId}`}
                className="kb-tap inline-flex min-h-10 shrink-0 items-center text-sm font-medium text-[var(--kb-accent)]"
              >
                現場を開く →
              </Link>
            </div>

            <ol className="mt-5 grid gap-2 md:grid-cols-3">
              {steps.map((step, index) => {
                const isNext = step.key === next;
                return (
                  <li
                    key={step.key}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                      isNext
                        ? "bg-[var(--kb-accent-soft)] ring-2 ring-[var(--kb-accent)]"
                        : step.done
                          ? "bg-[var(--kb-soft)]"
                          : "bg-zinc-50"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        step.done
                          ? "bg-emerald-600 text-white"
                          : isNext
                            ? "bg-[var(--kb-accent)] text-white"
                            : "bg-white text-zinc-500 ring-1 ring-[var(--kb-line)]"
                      }`}
                    >
                      {step.done ? "✓" : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{step.title}</span>
                      <span className="block text-sm text-zinc-500">{step.status}</span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="mt-5">
              <NextAction project={current} next={next} canTask={canTask} />
            </div>
          </article>
        </section>
      ) : (
        <EmptyGuide
          title="まず現場をひとつ登録しましょう"
          body="現場名を入れるだけで始められます。登録したら、写真を撮る → 作業をチェック → 日報を出す、の3ステップです。"
          action={
            <>
              {createProjectHref ? <AppLink href={createProjectHref}>最初の現場を登録する</AppLink> : null}
              <AppLink href="/sample" variant="secondary">
                日報の見本を見る
              </AppLink>
            </>
          }
        />
      )}

      <InstallHint />

      <OnboardingChecklist
        flags={onboarding}
        complete={onboarding.complete}
        firstProjectId={onboarding.firstProjectId}
        hasReport={onboarding.hasReport}
      />

      {current ? (
        <section id={TASKS_ANCHOR} className="scroll-mt-24">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">今日の作業</h2>
            <Link href="/tasks" className="text-sm font-medium text-zinc-500">
              すべて見る
            </Link>
          </div>
          <TaskList tasks={[...projectTasks, ...otherTasks]} canTask={canTask} showProject={projects.length > 1} />
          {canTask ? (
            <div id={TODAY_TASK_ANCHOR} className="mt-3 scroll-mt-24">
              <RevealPanel label={`＋ ${TODAY_TASK_LABEL}`} openOnHash={TODAY_TASK_ANCHOR}>
                <CreateTaskForm projectId={current.projectId} />
              </RevealPanel>
            </div>
          ) : null}
        </section>
      ) : null}

      {alertCount > 0 ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">お知らせ</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {ops.overdueTaskCount > 0 || ops.delayedCount > 0 ? (
              <li className="rounded-2xl bg-red-50 px-4 py-3 text-red-800 ring-1 ring-red-200">
                {ops.overdueTaskCount > 0 ? `期限切れの作業 ${ops.overdueTaskCount}件` : null}
                {ops.overdueTaskCount > 0 && ops.delayedCount > 0 ? " / " : null}
                {ops.delayedCount > 0 ? `工程の遅れ ${ops.delayedCount}件` : null}
              </li>
            ) : null}
            {pendingCaptureId ? (
              <li>
                <Link
                  href={`/captures/${pendingCaptureId}/confirm`}
                  className="kb-tap block rounded-2xl bg-amber-50 px-4 py-3 font-medium text-amber-950 ring-1 ring-amber-200"
                >
                  音声報告の確認が残っています →
                </Link>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function NextAction({
  project,
  next,
  canTask,
}: {
  project: TodayBoardProject;
  next: TodayStepKey | null;
  canTask: boolean;
}) {
  const photoHref = todayPhotoHref(project.projectId);
  const report =
    project.reportId != null ? (
      <AppLink
        href={todayReportHref(project.reportId)}
        variant={next === "report" ? "primary" : "secondary"}
        className="w-full"
      >
        {project.reportStatus === "confirmed" ? TODAY_REPORT_DONE_LABEL : TODAY_REPORT_REVIEW_LABEL}
      </AppLink>
    ) : (
      <CreateTodayReportButton
        projectId={project.projectId}
        label={TODAY_REPORT_LABEL}
        variant={next === "report" ? "primary" : "secondary"}
      />
    );

  if (next === "photo") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Link
          href={photoHref}
          className="kb-tap inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--kb-accent)] px-4 text-base font-medium text-white shadow-sm"
        >
          写真を撮る
        </Link>
        {report}
      </div>
    );
  }
  if (next === "task") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {canTask ? (
          <AppLink href={`#${TASKS_ANCHOR}`} className="w-full">
            作業をチェックする
          </AppLink>
        ) : null}
        {report}
      </div>
    );
  }
  if (next === "report") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {report}
        <AppLink href={photoHref} variant="secondary" className="w-full">
          写真を追加
        </AppLink>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-center text-sm font-medium text-emerald-700">今日の事務はすべて完了です。おつかれさまでした。</p>
      {report}
    </div>
  );
}

function TaskList({
  tasks,
  canTask,
  showProject,
}: {
  tasks: TodayFocusTask[];
  canTask: boolean;
  showProject: boolean;
}) {
  if (tasks.length === 0) {
    return <p className="mt-2 text-sm text-zinc-500">期限切れ・今日期限の作業はありません。</p>;
  }
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {tasks.map((task) => (
        <li
          key={task.id}
          className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1 ${
            task.overdue ? "bg-red-50 ring-red-200" : "bg-white ring-[var(--kb-line)]"
          }`}
        >
          <div className="min-w-0">
            {showProject ? <p className="truncate text-xs text-zinc-500">{task.projectName}</p> : null}
            <p className="font-medium">{task.title}</p>
            <p className={`text-sm ${task.overdue ? "text-red-700" : "text-zinc-500"}`}>
              {task.overdue ? "期限切れ" : task.dueToday ? "今日まで" : "進行中"}
              {task.dueOn ? `（${task.dueOn}）` : ""}
              {` · ${TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status}`}
            </p>
          </div>
          {canTask ? (
            <div className="shrink-0">
              <CompleteTaskButton taskId={task.id} projectId={task.projectId} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
