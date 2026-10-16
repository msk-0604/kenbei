import { describe, expect, it } from "vitest";
import {
  becameCompleted,
  calcProgressSummary,
  choiceFromMark,
  completedAtPatch,
  formatScheduleTime,
  nextProgressChoice,
  oneOffScheduleDates,
  progressItemLabel,
  scheduleSortKey,
  siteStatusLabel,
} from "./site-rules";

describe("site status (kenbei-alpha labels)", () => {
  it("uses 仮予定 / 進行中 / 完了", () => {
    expect(siteStatusLabel("draft")).toBe("仮予定");
    expect(siteStatusLabel("active")).toBe("進行中");
    expect(siteStatusLabel("completed")).toBe("完了");
  });

  it("notifies completion only on the transition into completed", () => {
    expect(becameCompleted("active", "completed")).toBe(true);
    expect(becameCompleted("draft", "completed")).toBe(true);
    expect(becameCompleted("completed", "completed")).toBe(false);
    expect(becameCompleted("completed", "active")).toBe(false);
  });

  it("follows the completed_at rule", () => {
    const now = new Date("2026-10-13T01:02:03.000Z");
    expect(completedAtPatch("active", "completed", now)).toEqual({ completed_at: now.toISOString() });
    expect(completedAtPatch("completed", "active", now)).toEqual({ completed_at: null });
    expect(completedAtPatch("completed", "completed", now)).toEqual({});
    expect(completedAtPatch("draft", "active", now)).toEqual({});
  });
});

describe("one-off sites", () => {
  it("creates one schedule per day from start to end", () => {
    expect(oneOffScheduleDates("one_off", "2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("uses the start date alone when there is no end date", () => {
    expect(oneOffScheduleDates("one_off", "2026-10-13", null)).toEqual(["2026-10-13"]);
  });

  it("caps at 60 days and never creates schedules for long-term sites", () => {
    expect(oneOffScheduleDates("one_off", "2026-01-01", "2026-12-31")).toHaveLength(60);
    expect(oneOffScheduleDates("long_term", "2026-10-13", "2026-10-20")).toEqual([]);
    expect(oneOffScheduleDates("one_off", null, "2026-10-20")).toEqual([]);
  });
});

describe("progress checklist", () => {
  it("percent = ok / all, rounded", () => {
    expect(calcProgressSummary([{ mark: "ok" }, { mark: "attention" }, { mark: "none" }])).toEqual({
      total: 3,
      completed: 1,
      attention: 1,
      pending: 2,
      percent: 33,
    });
    expect(calcProgressSummary([]).percent).toBe(0);
  });

  it("pressing the same button again does not reset to 未確認", () => {
    expect(nextProgressChoice("complete", "complete")).toBeNull();
    expect(nextProgressChoice("none", "incomplete")).toBe("incomplete");
    expect(choiceFromMark("ok")).toBe("complete");
    expect(choiceFromMark("attention")).toBe("incomplete");
    expect(choiceFromMark(null)).toBe("none");
  });

  it("labels items with their section", () => {
    expect(progressItemLabel({ section: "1階", item_name: "キッチン・給水" })).toBe("1階 キッチン・給水");
    expect(progressItemLabel({ section: null, item_name: "仕込" })).toBe("仕込");
  });
});

describe("schedule times", () => {
  it("sorts AM before PM and unset last", () => {
    const keys = [
      scheduleSortKey("unset", null),
      scheduleSortKey("timed", "13:00:00"),
      scheduleSortKey("am", null),
      scheduleSortKey("timed", "08:30:00"),
      scheduleSortKey("pm", null),
    ].sort();
    expect(keys).toEqual(["1-am", "2-08:30", "5-pm", "6-13:00", "9-unset"]);
  });

  it("formats time ranges", () => {
    expect(formatScheduleTime("timed", "08:30:00", "17:00:00")).toBe("08:30〜17:00");
    expect(formatScheduleTime("am", null, null)).toBe("午前");
    expect(formatScheduleTime(null, null, null)).toBe("時間未定");
  });
});
