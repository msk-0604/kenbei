import Link from "next/link";
import { briefWeeklySummary } from "@kensapo/ai";
import { AppShell } from "@/components/app-shell";
import { listRecentReports } from "@/features/reports/queries";
import { listTodayProjects } from "@/features/today/queries";
import { CreateTodayReportButton } from "@/features/reports/forms";
import { loadOpsBriefFacts } from "@/features/strategist/facts";
import { requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const workspace = await requireWorkspace();
  const [reports, today] = await Promise.all([listRecentReports(), listTodayProjects(workspace)]);
  const first = today[0];
  const weekly = await loadOpsBriefFacts(workspace.organizationId, first?.projectId ?? null);

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">日報</h1>
      {first ? (
        <div className="mt-6">
          <CreateTodayReportButton projectId={first.projectId} />
        </div>
      ) : null}
      <section className="mt-6 whitespace-pre-wrap rounded-3xl bg-white p-5 text-sm ring-1 ring-zinc-100">
        <h2 className="mb-2 text-base font-medium">週次要約（下書き）</h2>
        <p>{briefWeeklySummary(weekly)}</p>
        <p className="mt-2 text-xs text-zinc-500">確定操作ではありません。日報の確定は各日報画面で行います。</p>
      </section>
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
      {reports.length === 0 ? <p className="mt-6 text-zinc-500">日報はまだありません。</p> : null}
    </AppShell>
  );
}
