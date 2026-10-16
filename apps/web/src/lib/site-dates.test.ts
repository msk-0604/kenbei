import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  addMonthsISO,
  clampDateISO,
  dateRangeISO,
  formatShortDate,
  getMonthMatrixISO,
  getMonthMatrixSundayISO,
  tokyoDayBounds,
  weekdayIndex,
} from "./site-dates";

describe("calendar dates", () => {
  it("builds a Monday-first month including neighbours", () => {
    const dates = getMonthMatrixISO("2026-10-13");
    expect(dates[0]).toBe("2026-09-28");
    expect(dates.at(-1)).toBe("2026-11-01");
    expect(dates.length % 7).toBe(0);
    expect(weekdayIndex(dates[0] ?? "")).toBe(1);
  });

  it("builds a Sunday-first month including neighbours", () => {
    const dates = getMonthMatrixSundayISO("2026-10-13");
    expect(dates[0]).toBe("2026-09-27");
    expect(dates.at(-1)).toBe("2026-10-31");
    expect(weekdayIndex(dates[0] ?? "")).toBe(0);
  });

  it("moves by days and months without overflowing month ends", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonthsISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsISO("2026-03-15", -3)).toBe("2025-12-15");
  });

  it("rejects bad dates", () => {
    expect(clampDateISO("2026-02-30")).not.toBe("2026-02-30x");
    expect(clampDateISO("nope")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dateRangeISO("2026-10-05", "2026-10-01", 10)).toEqual(["2026-10-05"]);
  });

  it("filters completion dates on Japan time", () => {
    expect(tokyoDayBounds("2026-10-13")).toEqual({
      start: "2026-10-13T00:00:00+09:00",
      end: "2026-10-13T23:59:59.999+09:00",
    });
    expect(formatShortDate("2026-10-12T16:30:00Z")).toBe("2026/10/13");
  });
});
