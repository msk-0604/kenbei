import { describe, expect, it } from "vitest";
import {
  isSupportedPdfFontPath,
  isVariableOpenTypeFont,
  loadPdfFontBytes,
  pdfFontCandidates,
  resolvePdfFontFile,
} from "./pdf-font";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { buildPdf, needsJapaneseFont, pdfAttachmentHeaders, pdfFailed, sanitizePdfText, wrapPdfLines } from "./pdf-document";

describe("pdf font path", () => {
  it("rejects collection fonts and accepts ttf/otf", () => {
    expect(isSupportedPdfFontPath("/tmp/Noto.ttc")).toBe(false);
    expect(isSupportedPdfFontPath("/var/task/fonts/NotoSansJP-Regular.ttf")).toBe(true);
    expect(isSupportedPdfFontPath("C:\\\\fonts\\\\JP.otf")).toBe(true);
  });

  it("prefers env path then repo-relative fonts", () => {
    const list = pdfFontCandidates("/var/task/fonts/NotoSansJP-Regular.ttf", "/app");
    expect(list[0]).toBe("/var/task/fonts/NotoSansJP-Regular.ttf");
    expect(list.some((item) => item.endsWith("fonts/NotoSansJP-Regular.ttf") || item.endsWith("fonts\\NotoSansJP-Regular.ttf"))).toBe(
      true,
    );
  });

  it("uses only relative globs for Vercel file tracing", async () => {
    const { pdfFontTraceIncludes } = await import("./pdf-font-trace");
    expect(pdfFontTraceIncludes.length).toBeGreaterThan(0);
    for (const glob of pdfFontTraceIncludes) {
      expect(glob.startsWith("./")).toBe(true);
      expect(glob.includes("vercel/path0")).toBe(false);
    }
  });

  it("finds the committed Noto Sans JP file without PDF_FONT_PATH", () => {
    const file = resolvePdfFontFile("", process.cwd());
    expect(file).toBeTruthy();
    expect(file?.replaceAll("\\", "/").endsWith("fonts/NotoSansJP-Regular.ttf")).toBe(true);
    const bytes = loadPdfFontBytes("", process.cwd());
    expect(bytes).toBeTruthy();
    expect((bytes?.byteLength ?? 0) > 1000).toBe(true);
    expect(isVariableOpenTypeFont(bytes!)).toBe(true);
  });
});

describe("japanese report pdf", () => {
  it("treats daily-report copy as needing a CJK font", () => {
    expect(needsJapaneseFont("日報 2026-09-08")).toBe(true);
    expect(needsJapaneseFont("Report")).toBe(false);
  });

  it("embeds Japanese daily-report text into a PDF", { timeout: 60_000 }, async () => {
    const pdf = await buildPdf("日報 2026-09-08", ["有明アリーナ", "コンクリート打設を完了した。", "明日は養生確認。"]);
    expect(pdfFailed(pdf)).toBe(false);
    if (pdfFailed(pdf)) {
      return;
    }
    const header = Buffer.from(pdf.subarray(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it("wraps Japanese with the embedded Noto font without dropping characters", { timeout: 60_000 }, async () => {
    const sentence = "工程どおり進行。明日の作業内容を確認する。";
    const bytes = loadPdfFontBytes("", process.cwd());
    expect(bytes).toBeTruthy();
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(bytes!, { subset: false });
    const maxWidth = 90;
    const lines = wrapPdfLines(font, sentence, 11, maxWidth);
    expect(lines.join("")).toBe(sentence);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 11)).toBeLessThanOrEqual(maxWidth + 0.5);
    }
    const pdf = await buildPdf("日報 2026-09-12", [sentence]);
    expect(pdfFailed(pdf)).toBe(false);
    if (pdfFailed(pdf)) {
      return;
    }
    expect(Buffer.from(pdf.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it("sanitizes nullish and control characters, wraps ascii and specials, and paginates", { timeout: 60_000 }, async () => {
    expect(sanitizePdfText("a\r\nb\t\u0001c")).toBe("a\nb  c");
    const bytes = loadPdfFontBytes("", process.cwd());
    expect(bytes).toBeTruthy();
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(bytes!, { subset: false });
    const empty = wrapPdfLines(font, "", 11, 200);
    expect(empty).toEqual([" "]);
    const ascii = wrapPdfLines(font, "ABC123 site-A", 11, 400);
    expect(ascii.join("")).toBe("ABC123 site-A");
    const specials = "現場名（超長）<>&\"' 改行前\n改行後";
    const wrapped = wrapPdfLines(font, specials, 11, 80);
    expect(wrapped.join("").replace(/ /g, "")).toContain("改行後");
    for (const line of wrapped) {
      expect(font.widthOfTextAtSize(line, 11)).toBeLessThanOrEqual(80.5);
    }
    const longName = "東京都港区芝公園一丁目超長現場名".repeat(8);
    const longWork = "コンクリート打設および養生確認。".repeat(40);
    const pdf = await buildPdf(longName, ["写真なし", longWork, "①②③ / % $ #"]);
    expect(pdfFailed(pdf)).toBe(false);
    if (pdfFailed(pdf)) {
      return;
    }
    expect(Buffer.from(pdf.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(2000);
    const headers = pdfAttachmentHeaders("日報 2026-09-13.pdf");
    expect(headers["Content-Type"]).toBe("application/pdf");
    expect(headers["Content-Disposition"]).toMatch(/^attachment; filename="/);
    expect(headers["Content-Disposition"]).not.toContain("日報");
  });
});
