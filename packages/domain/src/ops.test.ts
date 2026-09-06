import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  estimateOfficeMinutes,
  isProcessDelayed,
  isTaskOverdue,
  parseSiteSearchQuery,
  projectProgressPercent,
} from "./ops";

describe("ops", () => {
  it("averages process percents", () => {
    expect(projectProgressPercent([0, 50, 100])).toBe(50);
    expect(projectProgressPercent([])).toBe(0);
  });

  it("flags delayed processes from planned end", () => {
    expect(
      isProcessDelayed({
        status: "in_progress",
        percent: 40,
        plannedEndOn: "2026-09-01",
        todayIso: "2026-09-03",
      }),
    ).toBe(true);
    expect(
      isProcessDelayed({
        status: "completed",
        percent: 100,
        plannedEndOn: "2026-09-01",
        todayIso: "2026-09-03",
      }),
    ).toBe(false);
  });

  it("flags overdue tasks", () => {
    expect(isTaskOverdue({ status: "todo", dueOn: "2026-09-01", todayIso: "2026-09-03" })).toBe(true);
    expect(isTaskOverdue({ status: "done", dueOn: "2026-09-01", todayIso: "2026-09-03" })).toBe(false);
  });

  it("parses relative photo search phrases", () => {
    expect(addDaysIso("2026-09-03", -3)).toBe("2026-08-31");
    const parsed = parseSiteSearchQuery("3日前 2階 トイレ 配管", "2026-09-03");
    expect(parsed.from).toBe("2026-08-31");
    expect(parsed.to).toBe("2026-08-31");
    expect(parsed.floor).toBe("2階");
    expect(parsed.text).toBe("トイレ 配管");
  });

  it("estimates office minutes saved", () => {
    const result = estimateOfficeMinutes({
      photoCount: 12,
      hasReportDraft: true,
      hasReportConfirmed: false,
      openTaskCount: 2,
    });
    expect(result.savedMinutes).toBeGreaterThan(30);
    expect(result.afterMinutes).toBeLessThan(result.beforeMinutes);
  });
});
