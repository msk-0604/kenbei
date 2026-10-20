import { describe, expect, it } from "vitest";
import { defaultReportSiteId, reportSiteChoices } from "./site-choices";

const a = { id: "a", name: "マンション改修" };
const b = { id: "b", name: "山田邸" };
const c = { id: "c", name: "倉庫" };

describe("report site choices", () => {
  it("puts today's scheduled sites first and lists each site once", () => {
    expect(reportSiteChoices({ scheduledToday: [b], assigned: [a, b], others: [c, a] })).toEqual([
      { id: "b", name: "山田邸", scheduledToday: true },
      { id: "a", name: "マンション改修", scheduledToday: false },
      { id: "c", name: "倉庫", scheduledToday: false },
    ]);
  });

  it("only preselects when there is no doubt", () => {
    expect(defaultReportSiteId(reportSiteChoices({ scheduledToday: [], assigned: [a], others: [] }))).toBe("a");
    expect(defaultReportSiteId(reportSiteChoices({ scheduledToday: [b], assigned: [a], others: [c] }))).toBe("b");
    expect(defaultReportSiteId(reportSiteChoices({ scheduledToday: [], assigned: [a], others: [b] }))).toBe("");
    expect(defaultReportSiteId(reportSiteChoices({ scheduledToday: [a, b], assigned: [], others: [] }))).toBe("");
    expect(defaultReportSiteId([])).toBe("");
  });
});
