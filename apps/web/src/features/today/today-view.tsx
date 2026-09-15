import Link from "next/link";
import { TASK_STATUS_LABELS } from "@kensapo/domain";
import { can } from "@/lib/authz-guard";
import type { Workspace } from "@/lib/session";
import { formatTokyoDate } from "@/lib/dates";
import { SiteButtons } from "@/features/today/site-buttons";
import { CompleteTaskButton } from "@/features/today/complete-task-button";
import { CreateTodayReportButton } from "@/features/reports/forms";
import type { TodayBoardProject, TodayOps } from "@/features/today/queries";
import type { TodayFocusTask } from "@/features/today/focus-tasks";
import { OnboardingChecklist } from "@/features/onboarding/checklist";
import type { OnboardingFlags } from "@kensapo/domain";
import { AppLink } from "@/components/app-nav";
import { EmptyGuide } from "@/components/empty-guide";
import { KenbeiFlow } from "@/features/product/kenbei-flow";
import { PRODUCT_LEAD, PRODUCT_SUPPORT } from "@/features/product/workflow";

const ROLE_LABEL: Record<string, string> = {
  owner: "代表",
  executive: "経営",
  manager: "管理",
  supervisor: "監督",
  worker: "作業",
  office: "事務",
  partner: "協力会社",
  guest: "ゲスト",
};

export function TodayView({
  workspace,
  projects,
  ops,
  pendingCaptureId,
  onboarding,
  signals,
  focusTasks,
}: {
  workspace: Workspace;
  projects: TodayBoardProject[];
  ops: TodayOps;
  pendingCaptureId: string | null;
  onboarding: OnboardingFlags & { complete: boolean; firstProjectId?: string | null; hasReport?: boolean };
  signals: { id: string; title: string; reason: string }[];
  focusTasks: TodayFocusTask[];
}) {
  const canCapture = can(workspace, "capture.create");
  const first = projects[0];
  const photoHref = first ? `/photos/upload?projectId=${first.projectId}` : "/photos/upload";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-zinc-500">{formatTokyoDate()}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">今日やること</h1>
        <p className="mt-2 text-base text-zinc-600">{PRODUCT_LEAD}</p>
        <div className="mt-4 rounded-3xl bg-[var(--kb-card)] p-4 ring-1 ring-[var(--kb-line)]">
          <KenbeiFlow compare />
          <p className="mt-3 text-sm leading-6 text-zinc-600">{PRODUCT_SUPPORT}</p>
        </div>
      </header>

      {first ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <AppLink href={photoHref}>写真を上げる</AppLink>
          <CreateTodayReportButton projectId={first.projectId} />
        </div>
      ) : (
        <EmptyGuide
          title="まだ現場がありません"
          body="最初の現場を登録すると、写真・タスク・日報をひとつにまとめられます。"
          action={
            can(workspace, "project.create") ? <AppLink href="/projects">現場を作成</AppLink> : undefined
          }
        />
      )}

      <section className="rounded-3xl bg-[var(--kb-card)] p-5 ring-1 ring-[var(--kb-line)]">
        <h2 className="text-lg font-semibold tracking-tight">今日のタスク</h2>
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
                  {can(workspace, "project.update") || can(workspace, "capture.create") ? (
                    <div className="mt-3">
                      <CompleteTaskButton taskId={task.id} projectId={task.projectId} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              今日のタスクはありません。現場写真から残作業をタスクにすると、ここでまとめて確認できます。
            </p>
            <div className="mt-4">
              <AppLink href={first ? photoHref : "/photos"} variant="secondary">
                {first ? "写真を上げる" : "写真を見る"}
              </AppLink>
            </div>
          </>
        )}
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
              軍師に聞く
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

      <p className="text-sm text-zinc-500">
        写真 {ops.photoCount}枚 / 未完了 {ops.openTaskCount}件 / 日報下書き {ops.draftReportCount}件
        {ops.confirmCount > 0 ? ` / 確認待ち ${ops.confirmCount}` : ""}
      </p>

      {projects.map((project) => (
        <section
          key={project.projectId}
          className="flex flex-col gap-4 rounded-3xl bg-[var(--kb-card)] p-5 ring-1 ring-[var(--kb-line)]"
        >
          <div>
            <h2 className="text-xl font-semibold">{project.projectName}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {ROLE_LABEL[project.roleInProject] ?? project.roleInProject}
              {project.delayed ? " / 遅延あり" : ""}
            </p>
            {project.address ? (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(project.address)}`}
                className="mt-2 inline-flex text-base text-zinc-700 underline"
              >
                {project.address}
              </a>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">住所未登録</p>
            )}
            <p className="mt-3 text-base leading-6 text-zinc-700">
              {project.workSummary ?? "今日の作業予定はまだありません。"}
            </p>
            <p className="mt-3 h-2 overflow-hidden rounded-full bg-[#efe8de]">
              <span
                className="block h-full rounded-full bg-[var(--kb-amber)]"
                style={{ width: `${Math.min(100, Math.max(0, project.progressPercent))}%` }}
              />
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              写真 {project.photoCount}枚 / 進捗 {project.progressPercent}% / 日報{" "}
              {project.reportStatus === "confirmed"
                ? "確定済"
                : project.reportStatus === "draft"
                  ? "下書き"
                  : "未作成"}
              {project.overdueTaskCount > 0 ? ` / 期限超過 ${project.overdueTaskCount}` : ""}
            </p>
          </div>
          {canCapture ? (
            <SiteButtons
              projectId={project.projectId}
              startedAt={project.startedAt}
              endedAt={project.endedAt}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <AppLink href={`/photos/upload?projectId=${project.projectId}`} variant="secondary">
              写真
            </AppLink>
            {project.reportId ? (
              <AppLink href={`/reports/${project.reportId}`} variant="secondary">
                日報を開く
              </AppLink>
            ) : (
              <CreateTodayReportButton projectId={project.projectId} />
            )}
          </div>
          <div className="flex flex-col gap-1">
            {canCapture ? (
              <AppLink href={`/capture?projectId=${project.projectId}`} variant="ghost" className="min-h-10 text-sm">
                音声で報告
              </AppLink>
            ) : null}
            <AppLink href={`/projects/${project.projectId}`} variant="ghost" className="min-h-10 text-sm">
              現場を見る
            </AppLink>
          </div>
        </section>
      ))}
    </div>
  );
}
