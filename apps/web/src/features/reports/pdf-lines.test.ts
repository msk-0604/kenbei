import { describe, expect, it } from "vitest";
import { weatherLineForPdf } from "@kensapo/domain";
import { dailyReportPdfLines } from "./pdf-lines";

describe("daily report PDF lines", () => {
  it("includes Japanese weather without emoji", () => {
    const lines = dailyReportPdfLines({
      projectName: "有明改修",
      weather: "☀️ 晴れ",
      body: "コンクリート打設を完了した。",
      safetyNotes: "異常なし",
      progressNote: "工程どおり",
      tomorrowPlan: "養生確認",
    });
    expect(lines[0]).toBe("有明改修");
    expect(lines).toContain("【天候】晴れ");
    expect(lines.join("\n")).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(weatherLineForPdf("雨")).toBe("【天候】雨");
  });

  it("omits empty weather for legacy reports", () => {
    const lines = dailyReportPdfLines({
      projectName: "現場A",
      weather: null,
      body: "作業実施",
      safetyNotes: null,
      progressNote: null,
      tomorrowPlan: null,
    });
    expect(lines).toEqual(["現場A", "作業実施"]);
  });
});
