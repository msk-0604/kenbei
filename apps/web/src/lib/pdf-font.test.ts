import { describe, expect, it } from "vitest";
import {
  isSupportedPdfFontPath,
  isVariableOpenTypeFont,
  loadPdfFontBytes,
  pdfFontCandidates,
  resolvePdfFontFile,
} from "./pdf-font";
import { buildPdf, needsJapaneseFont, pdfFailed } from "./pdf-document";

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
    const { pdfFontTraceIncludes } = await import("../../next.config");
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

  it("embeds Japanese daily-report text into a PDF", async () => {
    const pdf = await buildPdf("日報 2026-09-08", ["有明アリーナ", "コンクリート打設を完了した。", "明日は養生確認。"]);
    expect(pdfFailed(pdf)).toBe(false);
    if (pdfFailed(pdf)) {
      return;
    }
    const header = Buffer.from(pdf.subarray(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });
});
