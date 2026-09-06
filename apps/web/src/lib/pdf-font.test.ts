import { describe, expect, it } from "vitest";
import { isSupportedPdfFontPath, pdfFontCandidates } from "./pdf-font";

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
});
