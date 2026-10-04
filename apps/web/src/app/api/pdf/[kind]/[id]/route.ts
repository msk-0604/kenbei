import { NextResponse } from "next/server";
import { getPrintCompany, getReport } from "@/features/reports/queries";
import { weatherLineForPdf } from "@kensapo/domain";
import { buildReportPdf } from "@/lib/report-pdf";
import { getWorkspace } from "@/lib/session";
import { getProject } from "@/features/projects/queries";
import { listProjectProcesses, listProjectTasks, overallProgress } from "@/features/site-ops/queries";
import { buildPdf, pdfAttachmentHeaders, pdfFailed } from "@/lib/pdf-document";

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
    const company = await getPrintCompany(workspace.organizationName);
    const [logo, ...photos] = await Promise.all([
      company.logoUrl ? fetchBytes(company.logoUrl) : Promise.resolve(null),
      ...report.photoUrls.slice(0, 7).map((photo) => fetchBytes(photo.url)),
    ]);
    const pdf = await buildReportPdf({
      companyName: company.name,
      logo,
      workOn: report.workOn,
      projectName: report.projectName,
      authorName: report.authorName,
      weatherLine: weatherLineForPdf(report.weather),
      workerCount: report.workerCount,
      workLocation: report.workLocation,
      partnerCompanies: report.partnerCompaniesText,
      equipment: report.equipmentText,
      body: report.body,
      progressNote: report.progressNote,
      safetyNotes: report.safetyNotes,
      issues: report.issues,
      tomorrowPlan: report.tomorrowPlan,
      remarks: report.remarks,
      photos: photos.filter((item): item is Uint8Array => item != null),
    });
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

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return null;
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}
