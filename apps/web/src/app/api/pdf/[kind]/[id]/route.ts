import { NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import { getReport } from "@/features/reports/queries";
import { getWorkspace } from "@/lib/session";
import { getProject } from "@/features/projects/queries";
import { listProjectProcesses, listProjectTasks, overallProgress } from "@/features/site-ops/queries";
import { loadPdfFontBytes } from "@/lib/pdf-font";

function pdfFailed(value: Uint8Array | { error: string }): value is { error: string } {
  return !(value instanceof Uint8Array) && "error" in value;
}

function needsJapaneseFont(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
}

async function buildPdf(title: string, lines: string[]): Promise<Uint8Array | { error: string }> {
  const allText = [title, ...lines].join("\n");
  const fontBytes = loadPdfFontBytes();
  if (needsJapaneseFont(allText) && !fontBytes) {
    return {
      error:
        "日本語PDFには TTF/OTF フォントが必要です。fonts/NotoSansJP-Regular.ttf を置くか PDF_FONT_PATH を設定してください（.ttc 不可）。文字化けしたPDFは出力しません。",
    };
  }
  const doc = await PDFDocument.create();
  let font;
  try {
    if (!fontBytes) {
      const { StandardFonts } = await import("pdf-lib");
      font = await doc.embedFont(StandardFonts.Helvetica);
    } else {
      font = await doc.embedFont(fontBytes, { subset: true });
    }
  } catch {
    return { error: "指定された PDF_FONT_PATH のフォントを埋め込めませんでした。TTF/OTF を指定してください。" };
  }
  const pageSize: [number, number] = [595.28, 841.89];
  let page = doc.addPage(pageSize);
  let y = 790;
  const draw = (text: string, size: number) => {
    if (y < 64) {
      page = doc.addPage(pageSize);
      y = 790;
    }
    page.drawText(text.slice(0, 90) || " ", {
      x: 48,
      y,
      size,
      font,
      color: rgb(0.07, 0.07, 0.08),
    });
    y -= size + 8;
  };
  draw(title, 16);
  for (const line of lines) {
    draw(line || " ", 11);
  }
  return doc.save();
}

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
    const pdf = await buildPdf(`日報 ${report.workOn}`, [
      report.projectName,
      report.body,
      report.progressNote ?? "",
      report.tomorrowPlan ?? "",
    ]);
    if (pdfFailed(pdf)) {
      return NextResponse.json({ error: pdf.error }, { status: 422 });
    }
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${report.workOn}.pdf"`,
      },
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
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="project-${id.slice(0, 8)}.pdf"`,
      },
    });
  }
  return NextResponse.json({ error: "not found" }, { status: 404 });
}
