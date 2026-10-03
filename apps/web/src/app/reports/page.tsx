import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EmptyGuide } from "@/components/empty-guide";
import { AppLink } from "@/components/app-nav";
import { listRecentReports } from "@/features/reports/queries";
import { listTodayProjects } from "@/features/today/queries";
import { CreateTodayReportButton } from "@/features/reports/forms";
import { requireWorkspace } from "@/lib/authz-guard";
import { CREATE_PROJECT_PATH } from "@/features/projects/routes";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const workspace = await requireWorkspace();
  const [reports, today] = await Promise.all([listRecentReports(), listTodayProjects(workspace)]);
  const first = today[0];

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">日報</h1>
      {first && reports.length > 0 ? (
        <div className="mt-6">
          <CreateTodayReportButton projectId={first.projectId} />
        </div>
      ) : null}
      <ul className="mt-6 flex flex-col gap-3">
        {reports.map((report) => (
          <li key={report.id}>
            <Link href={`/reports/${report.id}`} className="block rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
              <p className="text-lg font-medium">{report.projectName}</p>
              <p className="mt-1 text-sm text-zinc-500">
                {report.workOn} / {report.status === "confirmed" ? "確定" : "下書き"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {reports.length === 0 ? (
        <div className="mt-6">
          <EmptyGuide
            title="まだ日報がありません"
            body="今日の作業と写真から、日報を作れます。"
            action={
              first ? (
                <CreateTodayReportButton projectId={first.projectId} />
              ) : (
                <AppLink href={CREATE_PROJECT_PATH}>現場を作成</AppLink>
              )
            }
          />
        </div>
      ) : null}
    </AppShell>
  );
}
