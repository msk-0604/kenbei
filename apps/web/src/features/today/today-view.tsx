import Link from "next/link";
import { estimateOfficeMinutes } from "@kensapo/domain";
import { can } from "@/lib/authz-guard";
import type { Workspace } from "@/lib/session";
import { formatTokyoDate } from "@/lib/dates";
import { SiteButtons } from "@/features/today/site-buttons";
import { CreateTodayReportButton } from "@/features/reports/forms";
import type { TodayBoardProject, TodayOps } from "@/features/today/queries";
import { OnboardingChecklist } from "@/features/onboarding/checklist";
import type { OnboardingFlags } from "@kensapo/domain";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
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
}: {
  workspace: Workspace;
  projects: TodayBoardProject[];
  ops: TodayOps;
  pendingCaptureId: string | null;
  onboarding: OnboardingFlags & { complete: boolean };
  signals: { id: string; title: string; reason: string }[];
}) {
  const canCapture = can(workspace, "capture.create");
  const first = projects[0];
  const estimate = estimateOfficeMinutes({
    photoCount: ops.photoCount,
    hasReportDraft: ops.draftReportCount > 0,
    hasReportConfirmed: projects.some((project) => project.reportStatus === "confirmed"),
    openTaskCount: ops.openTaskCount,
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-zinc-500">{formatTokyoDate()}</p>
        <p className="mt-2 text-sm font-medium tracking-wide text-[var(--kb-amber)]">KENBEI</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">今日の現場事務</h1>
        <p className="mt-2 text-base text-zinc-600">
          {workspace.displayName} / {workspace.organizationName}
        </p>
      </header>

      <OnboardingChecklist flags={onboarding} complete={onboarding.complete} />

      {signals.length > 0 ? (
        <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">今日注意すべきこと</h2>
            <Link href="/strategist" className="text-sm underline">
              今日何したらいい？
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

      <section className="rounded-3xl bg-[var(--kb-ink)] p-5 text-white">
        <p className="text-sm text-white/70">いまのペースだと</p>
        <p className="mt-2 text-3xl font-semibold">約 {estimate.afterMinutes} 分で終われる見込み</p>
        <p className="mt-2 text-sm text-white/80">
          従来の目安 {estimate.beforeMinutes} 分 → 約 {estimate.savedMinutes} 分短縮
        </p>
        <p className="mt-3 text-sm text-white/70">写真を上げて、日報を確定するだけで今日の事務が閉じます。</p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="今日の写真" value={`${ops.photoCount}枚`} />
        <Stat label="未完了" value={`${ops.openTaskCount}件`} />
        <Stat label="日報下書き" value={`${ops.draftReportCount}件`} />
        <Link href="/confirm" className="rounded-3xl bg-white p-4 ring-1 ring-[var(--kb-line)]">
          <p className="text-sm text-zinc-500">確認待ち</p>
          <p className="mt-1 text-2xl font-semibold">{ops.confirmCount}</p>
        </Link>
      </section>

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
          className="rounded-2xl bg-amber-50 px-4 py-3 text-base font-medium text-amber-950 ring-1 ring-amber-200"
        >
          音声報告の確認が残っています
        </Link>
      ) : null}

      {first ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/photos/upload?projectId=${first.projectId}`}
            className="flex items-center justify-center rounded-2xl bg-[var(--kb-ink)] text-base font-medium text-white"
          >
            写真を上げる
          </Link>
          <CreateTodayReportButton projectId={first.projectId} />
        </div>
      ) : null}

      {projects.length === 0 ? (
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[var(--kb-line)]">
          <p className="text-base leading-6 text-zinc-600">今日の現場はありません。</p>
          {can(workspace, "project.create") ? (
            <Link href="/projects" className="mt-4 inline-flex font-medium text-zinc-900 underline">
              現場を用意する
            </Link>
          ) : null}
        </section>
      ) : null}

      {projects.map((project) => (
        <section
          key={project.projectId}
          className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[var(--kb-line)]"
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
            <Link
              href={`/photos/upload?projectId=${project.projectId}`}
              className="flex items-center justify-center rounded-2xl bg-[var(--kb-ink)] text-base font-medium text-white"
            >
              写真
            </Link>
            {project.reportId ? (
              <Link
                href={`/reports/${project.reportId}`}
                className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white text-base font-medium"
              >
                日報を開く
              </Link>
            ) : (
              <CreateTodayReportButton projectId={project.projectId} />
            )}
          </div>
          {canCapture ? (
            <Link href={`/capture?projectId=${project.projectId}`} className="text-center text-sm text-zinc-500">
              音声で報告
            </Link>
          ) : null}
          <Link href={`/projects/${project.projectId}`} className="text-center text-sm text-zinc-500">
            現場を見る
          </Link>
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-[var(--kb-line)]">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
