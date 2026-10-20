import { describe, expect, it } from "vitest";
import { attendanceCsv, formatMinutes, monthBounds, normalizeMonth, summarizeAttendance, workMinutes } from "./summary";

const rec = (over: Partial<Parameters<typeof summarizeAttendance>[0][number]>) => ({
  date: "2026-10-20",
  workerId: "w1",
  workerName: "山田",
  siteId: "s1",
  siteName: "A邸",
  startedAt: "2026-10-20T08:00:00+09:00",
  endedAt: "2026-10-20T17:00:00+09:00",
  ...over,
});

describe("出面表", () => {
  it("counts days once per date and sums hours by worker and site", () => {
    const [w] = summarizeAttendance([
      rec({}),
      rec({ siteId: "s2", siteName: "B邸", startedAt: "2026-10-20T13:00:00+09:00", endedAt: "2026-10-20T15:30:00+09:00" }),
      rec({ date: "2026-10-21", startedAt: "2026-10-21T08:00:00+09:00", endedAt: "2026-10-21T12:00:00+09:00" }),
    ]);
    expect(w?.days).toBe(2);
    expect(w?.minutes).toBe(9 * 60 + 150 + 4 * 60);
    expect(w?.sites).toEqual([
      { siteId: "s1", siteName: "A邸", days: 2, minutes: 13 * 60 },
      { siteId: "s2", siteName: "B邸", days: 1, minutes: 150 },
    ]);
  });

  it("skips records that never started and flags ones that never ended", () => {
    const [w, none] = summarizeAttendance([
      rec({ startedAt: null, endedAt: null }),
      rec({ date: "2026-10-22", endedAt: null }),
    ]);
    expect(none).toBeUndefined();
    expect(w?.days).toBe(1);
    expect(w?.minutes).toBe(0);
    expect(w?.openCount).toBe(1);
  });

  it("formats and exports for Excel", () => {
    expect(formatMinutes(510)).toBe("8時間30分");
    expect(formatMinutes(0)).toBe("0時間");
    expect(workMinutes("2026-10-20T17:00:00+09:00", "2026-10-20T08:00:00+09:00")).toBeNull();
    const csv = attendanceCsv(summarizeAttendance([rec({ siteName: 'A邸, "2F"' })]), (iso) => (iso ? iso.slice(11, 16) : ""));
    expect(csv.startsWith("﻿日付,作業員,現場")).toBe(true);
    expect(csv).toContain('2026-10-20,山田,"A邸, ""2F""",08:00,17:00,9.00,');
  });

  it("reads the month safely", () => {
    expect(normalizeMonth("2026-02", "2026-10-20")).toBe("2026-02");
    expect(normalizeMonth("2026-13", "2026-10-20")).toBe("2026-10");
    expect(normalizeMonth(undefined, "2026-10-20")).toBe("2026-10");
    expect(monthBounds("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});
