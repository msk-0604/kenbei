import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { loadPdfFontBytes } from "./pdf-font";
import { sanitizePdfText, wrapPdfLines } from "./pdf-document";

export type ReportPdfInput = {
  companyName: string;
  logo?: Uint8Array | null;
  workOn: string;
  projectName: string;
  authorName: string | null;
  weatherLine: string | null;
  workerCount: number | null;
  workLocation: string | null;
  partnerCompanies: string | null;
  equipment: string | null;
  body: string;
  progressNote: string | null;
  safetyNotes: string | null;
  issues: string | null;
  tomorrowPlan: string | null;
  remarks: string | null;
  photos: Uint8Array[];
};

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 42;
const INK = rgb(0.06, 0.07, 0.1);
const MUTED = rgb(0.4, 0.43, 0.48);
const LINE = rgb(0.82, 0.84, 0.87);

function isJpeg(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isPng(bytes: Uint8Array): boolean {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

async function embedImage(doc: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> {
  try {
    if (isJpeg(bytes)) {
      return await doc.embedJpg(bytes);
    }
    if (isPng(bytes)) {
      return await doc.embedPng(bytes);
    }
  } catch {
    return null;
  }
  return null;
}

function fit(image: PDFImage, maxW: number, maxH: number): { width: number; height: number } {
  const scale = Math.min(maxW / image.width, maxH / image.height, 1);
  return { width: image.width * scale, height: image.height * scale };
}

/** A4 工事日報 laid out like the print page, with a subset Japanese font. */
export async function buildReportPdf(input: ReportPdfInput): Promise<Uint8Array | { error: string }> {
  const regularBytes = loadPdfFontBytes();
  if (!regularBytes) {
    return { error: "日本語PDFのフォントが見つかりません。apps/web/fonts を確認してください。" };
  }
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`工事日報 ${input.projectName} ${input.workOn}`);
  doc.setProducer("KENBEI");
  // The bundled font is already trimmed to JIS X 0208 + extras; pdf-lib's own
  // subsetting drops CJK glyphs, so embed it whole (about 1.3MB compressed).
  let font: PDFFont;
  try {
    font = await doc.embedFont(regularBytes, { subset: false });
  } catch {
    return { error: "日本語フォントをPDFに埋め込めませんでした。" };
  }

  const contentWidth = A4[0] - MARGIN * 2;
  let page: PDFPage = doc.addPage(A4);
  let y = A4[1] - MARGIN;
  let pageNo = 1;

  const footer = (target: PDFPage, no: number) => {
    target.drawText(`KENBEI  ${input.projectName}  ${input.workOn}  ${no}`, {
      x: MARGIN,
      y: 24,
      size: 8,
      font,
      color: MUTED,
    });
  };
  const ensure = (height: number) => {
    if (y - height < 48) {
      footer(page, pageNo);
      page = doc.addPage(A4);
      pageNo += 1;
      y = A4[1] - MARGIN;
    }
  };
  const text = (value: string, x: number, size: number, heavy = false, color = INK) => {
    page.drawText(value, { x, y, size, font, color });
    if (heavy) {
      // One embedded weight keeps the file small; overprint for headings.
      page.drawText(value, { x: x + size * 0.03, y, size, font, color });
    }
  };

  // Header
  const logo = input.logo ? await embedImage(doc, input.logo) : null;
  let headerLeftY = y;
  if (logo) {
    const dims = fit(logo, 120, 32);
    page.drawImage(logo, { x: MARGIN, y: y - dims.height, ...dims });
    headerLeftY = y - dims.height - 6;
  }
  y = headerLeftY - 10;
  text(sanitizePdfText(input.companyName), MARGIN, 10);
  y -= 26;
  text("工事日報", MARGIN, 22, true);
  const rightLines = [input.workOn, input.projectName, input.authorName ? `記入者 ${input.authorName}` : ""].filter(Boolean);
  let ry = A4[1] - MARGIN - 10;
  for (const line of rightLines) {
    const value = sanitizePdfText(line);
    const width = font.widthOfTextAtSize(value, 10);
    page.drawText(value, { x: A4[0] - MARGIN - width, y: ry, size: 10, font, color: INK });
    ry -= 15;
  }
  y = Math.min(y, ry) - 12;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 1, color: LINE });
  y -= 14;

  // Photos
  const images: PDFImage[] = [];
  for (const bytes of input.photos.slice(0, 7)) {
    const image = await embedImage(doc, bytes);
    if (image) {
      images.push(image);
    }
  }
  const [hero, ...rest] = images;
  if (hero) {
    const dims = fit(hero, contentWidth, 210);
    ensure(dims.height + 12);
    page.drawImage(hero, { x: MARGIN + (contentWidth - dims.width) / 2, y: y - dims.height, ...dims });
    y -= dims.height + 16;
  }

  // Facts grid (2 columns)
  const facts: [string, string][] = [
    ["天候", input.weatherLine?.replace(/^【天候】/, "") || "-"],
    ["作業人数", input.workerCount != null ? `${input.workerCount}名` : "-"],
    ["作業箇所", input.workLocation || "-"],
    ["協力会社", input.partnerCompanies || "-"],
  ];
  if (input.equipment) {
    facts.push(["使用機材", input.equipment]);
  }
  const colW = contentWidth / 2;
  for (let index = 0; index < facts.length; index += 2) {
    ensure(26);
    page.drawRectangle({ x: MARGIN, y: y - 22, width: contentWidth, height: 22, borderColor: LINE, borderWidth: 0.6 });
    for (let col = 0; col < 2; col += 1) {
      const fact = facts[index + col];
      if (!fact) {
        continue;
      }
      const x = MARGIN + col * colW;
      page.drawText(fact[0], { x: x + 8, y: y - 15, size: 9, font, color: MUTED });
      const value = wrapPdfLines(font, fact[1], 10, colW - 70)[0] ?? "";
      page.drawText(value, { x: x + 62, y: y - 15, size: 10, font, color: INK });
    }
    y -= 22;
  }
  y -= 16;

  // Sections
  const sections: [string, string | null][] = [
    ["作業内容", input.body],
    ["進捗", input.progressNote],
    ["安全事項", input.safetyNotes?.replace(/^【安全】\s*/, "") ?? null],
    ["問題事項", input.issues],
    ["翌日予定", input.tomorrowPlan],
    ["備考", input.remarks],
  ];
  for (const [label, value] of sections) {
    if (label === "備考" && !value) {
      continue;
    }
    ensure(34);
    text(label, MARGIN, 11, true);
    y -= 17;
    for (const line of wrapPdfLines(font, value?.trim() || "なし", 10.5, contentWidth)) {
      ensure(16);
      text(line, MARGIN, 10.5);
      y -= 16;
    }
    y -= 8;
  }

  // Remaining photos, 3 per row
  if (rest.length > 0) {
    const gap = 8;
    const cellW = (contentWidth - gap * 2) / 3;
    const cellH = 110;
    ensure(24 + 110 + 8);
    text("現場写真", MARGIN, 11, true);
    y -= 14;
    for (let index = 0; index < rest.length; index += 3) {
      ensure(cellH + gap);
      for (let col = 0; col < 3; col += 1) {
        const image = rest[index + col];
        if (!image) {
          continue;
        }
        const dims = fit(image, cellW, cellH);
        const x = MARGIN + col * (cellW + gap) + (cellW - dims.width) / 2;
        page.drawImage(image, { x, y: y - cellH + (cellH - dims.height) / 2, ...dims });
      }
      y -= cellH + gap;
    }
  }

  footer(page, pageNo);
  return doc.save();
}
