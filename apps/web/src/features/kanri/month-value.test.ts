import { describe, expect, it } from "vitest";
import { estimateMonthValue, formatSavedTime } from "./month-value";

describe("今月の KENBEI", () => {
  it("estimates saved time from reports and attendance", () => {
    const value = estimateMonthValue({ reports: 20, photos: 300, workdays: 100 });
    expect(value.minutesSaved).toBe(20 * 45 + 100 * 3);
    expect(value.yenSaved).toBe(50000);
  });

  it("shows nothing saved when nothing was done", () => {
    expect(estimateMonthValue({ reports: 0, photos: 0, workdays: 0 })).toMatchObject({ minutesSaved: 0, yenSaved: 0 });
  });

  it("formats time in plain words", () => {
    expect(formatSavedTime(45)).toBe("約45分");
    expect(formatSavedTime(1200)).toBe("約20時間");
    expect(formatSavedTime(135)).toBe("約2.3時間");
  });
});
