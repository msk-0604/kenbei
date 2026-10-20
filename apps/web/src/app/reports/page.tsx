import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EmptyGuide } from "@/components/empty-guide";
import { AppLink } from "@/components/app-nav";
import { listRecentReports } from "@/features/reports/queries";
import { listTodayProjects } from "@/features/today/queries";
import { getDaySites, listSites, toSiteOptions } from "@/features/sites/queries";
import { CreateTodayReportPicker } from "@/features/reports/forms";
import { reportSiteChoices } from "@/features/reports/site-choices";
import { isSiteAdmin, requireWorkspace } from "@/lib/authz-guard";
import { tokyoTodayIso } from "@/lib/dates";
import { CREATE_PROJECT_PATH } from "@/features/projects/routes";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const workspace = await requireWorkspace();
  const isAdmin = isSiteAdmin(workspace);
  const [reports, today, scheduledToday, allSites] = await Promise.all([
    listRecentReports(),
    listTodayProjects(workspace),
    getDaySites(tokyoTodayIso()).catch(() => []),
    isAdmin ? listSites().then(toSiteOptions) : Promise.resolve([]),
  ]);
  const assigned = today.map((project) => ({ id: project.projectId, name: project.projectName }));
  // 管理者はどの現場でも選べる。それ以外の人は、これまでどおり自分が入っている現場だけ。
  const assignedIds = new Set(assigned.map((site) => site.id));
  const sites = reportSiteChoices({
    scheduledToday: isAdmin ? scheduledToday : scheduledToday.filter((site) => assignedIds.has(site.id)),
    assigned,
    others: allSites,
  });

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">日報</h1>
      {sites.length > 0 && reports.length > 0 ? (
        <div className="mt-6">
          <CreateTodayReportPicker sites={sites} />
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
              sites.length > 0 ? (
                <CreateTodayReportPicker sites={sites} />
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
