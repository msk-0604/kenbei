import { NextResponse } from "next/server";
import { getReport } from "@/features/reports/queries";
import { getWorkspace } from "@/lib/session";
import { getProject } from "@/features/projects/queries";
import { listProjectProcesses, listProjectTasks, overallProgress } from "@/features/site-ops/queries";
import { buildPdf, pdfAttachmentHeaders, pdfFailed } from "@/lib/pdf-document";
import { dailyReportPdfLines } from "@/features/reports/pdf-lines";

export async function GET(
  _request: Request,
  context: { params: Promise<{ kind: string; id: string }> },
) {
  const workspace = await getWorkspace();
  if (!workspace?.organizationId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { kind, id } = await context.params;
  if (kind === "report") {
    const report = await getReport(id);
    if (!report) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const pdf = await buildPdf(`日報 ${report.workOn}`, dailyReportPdfLines(report));
    if (pdfFailed(pdf)) {
      return NextResponse.json({ error: pdf.error }, { status: 422 });
    }
    return new NextResponse(Buffer.from(pdf), {
      headers: pdfAttachmentHeaders(`report-${report.workOn}.pdf`),
    });
  }
  if (kind === "project") {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const [processes, tasks] = await Promise.all([listProjectProcesses(id), listProjectTasks(id)]);
    const pdf = await buildPdf(`現場サマリー ${project.name}`, [
      `進捗 ${overallProgress(processes)}%`,
      ...processes.map((item) => `${item.name} ${item.percent}% ${item.delayed ? "遅延" : ""}`),
      ...tasks.slice(0, 15).map((item) => `${item.title} ${item.status}`),
    ]);
    if (pdfFailed(pdf)) {
      return NextResponse.json({ error: pdf.error }, { status: 422 });
    }
    return new NextResponse(Buffer.from(pdf), {
      headers: pdfAttachmentHeaders(`project-${id.slice(0, 8)}.pdf`),
    });
  }
  return NextResponse.json({ error: "not found" }, { status: 404 });
}
