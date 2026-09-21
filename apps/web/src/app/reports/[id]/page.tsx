import Link from "next/link";
import { notFound } from "next/navigation";
import { weatherLineForPdf } from "@kensapo/domain";
import { AppShell } from "@/components/app-shell";
import { ConfirmReportButton, ReportEditor } from "@/features/reports/forms";
import { getReport } from "@/features/reports/queries";
import { searchPhotos } from "@/features/photos/queries";
import { listProjectTasks } from "@/features/site-ops/queries";
import { requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireWorkspace();
  const { id } = await params;
  const report = await getReport(id);
  if (!report) {
    notFound();
  }
  const [photos, tasks] = await Promise.all([
    searchPhotos({
      projectId: report.projectId,
      from: report.workOn,
      to: report.workOn,
    }),
    listProjectTasks(report.projectId),
  ]);
  const weatherLine = weatherLineForPdf(report.weather);
  const isDraft = report.status === "draft";

  return (
    <AppShell>
      <p className="text-sm text-zinc-500">
        <Link href="/reports">日報</Link>
        {" / "}
        <Link href={`/projects/${report.projectId}?tab=reports`}>{report.projectName}</Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{report.workOn}</h1>
      <p className="mt-2 text-sm text-zinc-500">
        {report.authorName ?? "記入者未設定"} / {isDraft ? "下書き" : "確定"}
        {report.draftSource === "auto" ? " / 自動生成" : ""}
      </p>
      {isDraft ? (
        <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
          <ReportEditor
            report={report}
            photos={photos}
            tasks={tasks.map((task) => ({ title: task.title, status: task.status }))}
          />
        </div>
      ) : (
        <article className="mt-6 rounded-3xl bg-white p-5 text-base leading-7 ring-1 ring-zinc-100">
          {weatherLine ? <p className="text-sm text-zinc-600">{weatherLine}</p> : null}
          {report.photoUrls.length > 0 ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {report.photoUrls.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={photo.id} src={photo.url} alt="" className="h-24 w-full rounded-xl object-cover" />
              ))}
            </div>
          ) : null}
          <p className="mt-4 whitespace-pre-wrap">{report.body}</p>
        </article>
      )}
      <div className="mt-6 flex flex-col gap-3">
        {isDraft ? <ConfirmReportButton reportId={report.id} disabled={false} /> : null}
        {report.status === "confirmed" ? (
          <Link
            href={`/reports/${report.id}/print`}
            className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white font-medium"
          >
            PDF / 印刷
          </Link>
        ) : (
          <p className="text-sm text-zinc-500">確定すると印刷できます。</p>
        )}
      </div>
    </AppShell>
  );
}
