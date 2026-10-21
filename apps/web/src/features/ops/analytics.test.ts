import { describe, expect, it } from "vitest";
import {
  biggestDrop,
  conversionByMonth,
  conversionBySource,
  excludeInternal,
  featureUsage,
  funnel,
  orgFactsCsv,
  weekStartJst,
  weeklyTrend,
  type OrgFacts,
} from "./analytics";

const org = (id: string, over: Partial<OrgFacts> = {}): OrgFacts => ({
  organizationId: id,
  name: `会社${id}`,
  createdAt: "2026-10-05T03:00:00Z",
  ownerEmail: `${id}@example.com`,
  source: "フォーム営業",
  paying: false,
  everPaid: false,
  hasSite: false,
  hasWorker: false,
  hasSchedule: false,
  hasWorkStart: false,
  hasConfirmedReport: false,
  ...over,
});

describe("運営の分析", () => {
  it("counts each funnel step only when the earlier steps are done", () => {
    const rows = funnel([
      org("a"),
      org("b", { hasSite: true }),
      org("c", { hasSite: true, hasWorker: true, hasSchedule: true }),
      org("d", { hasSite: true, hasWorker: true, hasSchedule: true, hasWorkStart: true, hasConfirmedReport: true, paying: true }),
      org("e", { hasSchedule: true }),
    ]);
    expect(rows.map((row) => row.count)).toEqual([5, 3, 2, 2, 1, 1, 1]);
    expect(rows[1]?.rateFromPrev).toBeCloseTo(0.6);
    expect(biggestDrop(rows)?.key).toBe("site");
  });

  it("uses Monday weeks in Japan time", () => {
    expect(weekStartJst("2026-10-18T16:00:00Z")).toBe("2026-10-19"); // 月曜 1:00 JST
    expect(weekStartJst("2026-10-18T14:00:00Z")).toBe("2026-10-12"); // 日曜 23:00 JST
  });

  it("builds a weekly trend with active companies", () => {
    const now = new Date("2026-10-21T03:00:00Z");
    const weeks = weeklyTrend(
      [org("a", { createdAt: "2026-10-20T01:00:00Z" })],
      [
        { organizationId: "a", at: "2026-10-20T01:00:00Z", kind: "schedule" },
        { organizationId: "a", at: "2026-10-20T02:00:00Z", kind: "report", n: 3 },
        { organizationId: "b", at: "2026-10-13T02:00:00Z", kind: "photo" },
        { organizationId: "b", at: "2026-01-01T02:00:00Z", kind: "photo" },
      ],
      now,
      2,
      [{ day: "2026-10-14", n: 40 }, { day: "2026-10-20", n: 12 }],
    );
    expect(weeks).toEqual([
      { week: "2026-10-12", visits: 40, signups: 0, activeOrgs: 1, schedules: 0, workStarts: 0, photos: 1, reports: 0 },
      { week: "2026-10-19", visits: 12, signups: 1, activeOrgs: 1, schedules: 1, workStarts: 0, photos: 0, reports: 3 },
    ]);
  });

  it("measures feature usage over the last 30 days", () => {
    const now = new Date("2026-10-21T00:00:00Z");
    const usage = featureUsage(
      [org("a"), org("b")],
      [
        { organizationId: "a", at: "2026-10-20T00:00:00Z", kind: "photo" },
        { organizationId: "a", at: "2026-10-19T00:00:00Z", kind: "photo" },
        { organizationId: "b", at: "2026-08-01T00:00:00Z", kind: "photo" },
      ],
      now,
    );
    expect(usage.find((row) => row.kind === "photo")).toMatchObject({ orgs: 1, rate: 0.5, count: 2 });
  });

  it("computes conversion and leaves out our own test companies", () => {
    const orgs = excludeInternal(
      [org("a", { paying: true }), org("b"), org("c", { createdAt: "2026-09-10T00:00:00Z", source: "不明", everPaid: true }), org("me", { ownerEmail: "Owner@Kenbei.jp" })],
      "owner@kenbei.jp",
    );
    expect(orgs.map((o) => o.organizationId)).toEqual(["a", "b", "c"]);
    expect(conversionByMonth(orgs)).toEqual([
      { key: "2026-10", signups: 2, paid: 1, rate: 0.5 },
      { key: "2026-09", signups: 1, paid: 1, rate: 1 },
    ]);
    expect(conversionBySource(orgs)[0]).toEqual({ key: "フォーム営業", signups: 2, paid: 1, rate: 0.5 });
    expect(orgFactsCsv(orgs).split("\r\n")[1]).toBe("会社a,2026-10-05,a@example.com,フォーム営業,1,0,0,0,0,0,0");
  });
});
