import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrintCompany, getReport } from "@/features/reports/queries";
import { PrintButton } from "@/features/reports/print-button";
import { requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function ReportPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const workspace = await requireWorkspace();
  const { id } = await params;
  const report = await getReport(id);
  if (!report || report.status !== "confirmed") {
    notFound();
  }
  const company = await getPrintCompany(workspace.organizationName);
  const hero = report.photoUrls[0];

  return (
    <div className="mx-auto min-h-dvh max-w-[210mm] bg-white px-8 py-8 text-zinc-900 print:px-0 print:py-0">
      <style>{`
        @page { size: A4 portrait; margin: 16mm; }
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>
      <p className="no-print mb-6 text-sm">
        <Link href={`/reports/${report.id}`} className="underline">
          日報に戻る
        </Link>
        <a href={`/api/pdf/report/${report.id}`} className="ml-4 underline">
          PDFをダウンロード
        </a>
        <PrintButton />
      </p>
      <header className="flex items-start justify-between gap-6 border-b border-zinc-300 pb-4">
        <div>
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt="" className="mb-3 h-10 object-contain" />
          ) : null}
          <p className="text-sm">{company.name}</p>
          <h1 className="mt-1 text-2xl font-semibold">工事日報</h1>
        </div>
        <div className="text-right text-sm">
          <p>{report.workOn}</p>
          <p className="mt-1">{report.projectName}</p>
          <p className="mt-1">{report.authorName}</p>
        </div>
      </header>
      {hero ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hero.url} alt="" className="mt-4 h-48 w-full object-cover" />
      ) : null}
      <section className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <p>天候: {report.weather ?? "—"}</p>
        <p>作業人数: {report.workerCount ?? "—"}</p>
        <p>作業箇所: {report.workLocation ?? "—"}</p>
        <p>協力会社: {report.partnerCompaniesText ?? "—"}</p>
      </section>
      <section className="mt-6">
        <h2 className="text-sm font-semibold">作業内容</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{report.body}</p>
      </section>
      <section className="mt-6">
        <h2 className="text-sm font-semibold">進捗</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{report.progressNote ?? "—"}</p>
      </section>
      <section className="mt-6">
        <h2 className="text-sm font-semibold">安全事項</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{report.safetyNotes ?? "—"}</p>
      </section>
      <section className="mt-6">
        <h2 className="text-sm font-semibold">問題事項</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{report.issues ?? "—"}</p>
      </section>
      <section className="mt-6">
        <h2 className="text-sm font-semibold">翌日予定</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{report.tomorrowPlan ?? "—"}</p>
      </section>
      {report.photoUrls.length > 1 ? (
        <section className="mt-6 grid grid-cols-3 gap-2">
          {report.photoUrls.slice(1, 7).map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={photo.id} src={photo.url} alt="" className="h-24 w-full object-cover" />
          ))}
        </section>
      ) : null}
    </div>
  );
}
