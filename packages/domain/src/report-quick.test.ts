import { describe, expect, it } from "vitest";
import { workspaceWriteBlockMessage, workspaceWritesAllowed } from "./billing-access";
import { assertSameOrganization } from "./ops-platform";
import {
  appendReportLine,
  formatSafetyNotes,
  isKnownWeather,
  openTaskTitles,
  parseSafetyNotes,
  REPORT_SAFETY_NOTE_PRESET,
  TASK_QUICK_PRESETS,
  dueOnForChip,
  weatherLineForPdf,
  weatherTextForStorage,
  workCandidatesFromTasks,
} from "./report-quick";

describe("report weather", () => {
  it("stores a one-tap weather value without emoji", () => {
    expect(weatherTextForStorage("☀️ 晴れ")).toBe("晴れ");
    expect(weatherTextForStorage("くもり")).toBe("くもり");
    expect(weatherTextForStorage("曇り")).toBe("くもり");
    expect(isKnownWeather("雨")).toBe(true);
    expect(isKnownWeather("強風")).toBe(false);
  });

  it("prints weather as Japanese text only for PDF", () => {
    expect(weatherLineForPdf("🌧️ 雨")).toBe("【天候】雨");
    expect(weatherLineForPdf("☀️")).toBeNull();
    expect(weatherLineForPdf(null)).toBeNull();
    expect(weatherLineForPdf("晴れ") ?? "").not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it("keeps unknown legacy weather strings", () => {
    expect(weatherTextForStorage("台風接近")).toBe("台風接近");
    expect(weatherLineForPdf("台風接近")).toBe("【天候】台風接近");
  });
});

describe("report work and tomorrow lines", () => {
  it("adds a task title to work notes once", () => {
    const once = appendReportLine("", "配筋確認");
    expect(once).toBe("・配筋確認");
    expect(appendReportLine(once, "配筋確認")).toBe("・配筋確認");
    expect(appendReportLine(once, "KY実施")).toBe("・配筋確認\n・KY実施");
  });

  it("prefers existing tasks for work chips, fallbacks when empty", () => {
    expect(workCandidatesFromTasks([]).map((item) => item.title)).toContain("コンクリート打設");
    expect(
      workCandidatesFromTasks([
        { title: "配筋確認", status: "done" },
        { title: "型枠", status: "todo" },
      ]),
    ).toEqual([
      { title: "配筋確認", done: true },
      { title: "型枠", done: false },
    ]);
  });

  it("maps due chips to Tokyo calendar days", () => {
    expect(dueOnForChip("today", "2026-09-21")).toBe("2026-09-21");
    expect(dueOnForChip("tomorrow", "2026-09-21")).toBe("2026-09-22");
    expect(dueOnForChip("none", "2026-09-21")).toBe("");
    expect(TASK_QUICK_PRESETS).toContain("配筋確認");
  });

  it("offers open tasks as tomorrow candidates", () => {
    expect(
      openTaskTitles([
        { title: "養生", status: "todo" },
        { title: "打設", status: "done" },
      ]),
    ).toEqual(["養生"]);
  });
});

describe("report safety presets", () => {
  it("joins multi-select safety and extra notes", () => {
    const stored = formatSafetyNotes(["KY実施", REPORT_SAFETY_NOTE_PRESET], "開口部養生");
    expect(stored).toContain("KY実施");
    expect(stored).toContain("開口部養生");
    const parsed = parseSafetyNotes(stored);
    expect(parsed.selected).toContain("KY実施");
    expect(parsed.selected).toContain(REPORT_SAFETY_NOTE_PRESET);
    expect(parsed.extra).toBe("開口部養生");
  });

  it("keeps legacy free-text safety notes", () => {
    const parsed = parseSafetyNotes("KY実施。高所・火気・開口部・通路の確認。");
    expect(parsed.selected).toContain("KY実施");
    expect(parsed.extra).toContain("高所");
  });
});

describe("report write guards stay in place", () => {
  it("allows active trial writes and blocks expired trial", () => {
    expect(workspaceWritesAllowed("trial_active")).toBe(true);
    expect(workspaceWritesAllowed("trial_expired")).toBe(false);
    expect(workspaceWriteBlockMessage("trial_expired")).toBeTruthy();
  });

  it("does not mix organization ids", () => {
    expect(assertSameOrganization("org-a", "org-b")).toBe(false);
    expect(assertSameOrganization("org-a", "org-a")).toBe(true);
  });
});
