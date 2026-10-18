import { describe, expect, it } from "vitest";
import { classifyOrgHealth, describeOrgSource, isPlatformAdminEmail, summarizeOverview, type OrgOverviewRow } from "./org-health";

const now = new Date("2026-10-17T12:00:00Z");

function row(patch: Partial<OrgOverviewRow> = {}): OrgOverviewRow {
  return {
    organization_id: "org-1",
    name: "山本建設",
    created_at: "2026-10-01T00:00:00Z",
    plan_code: "pro",
    billing_status: "active",
    trial_ends_at: null,
    current_period_end: null,
    cancel_at_period_end: false,
    owner_email: "owner@example.jp",
    member_count: 3,
    worker_count: 5,
    site_count: 4,
    schedules_7d: 10,
    schedules_30d: 40,
    reports_30d: 5,
    photos_30d: 30,
    last_activity_at: "2026-10-17T08:00:00Z",
    last_sign_in_at: "2026-10-17T08:00:00Z",
    ...patch,
  };
}

describe("classifyOrgHealth", () => {
  it("is healthy when schedules are being used", () => {
    expect(classifyOrgHealth(row(), now)).toMatchObject({ kind: "healthy", needsFollowUp: false });
  });

  it("flags unpaid invoices first", () => {
    expect(classifyOrgHealth(row({ billing_status: "past_due" }), now).kind).toBe("unpaid");
  });

  it("flags companies that have not registered a site", () => {
    const health = classifyOrgHealth(row({ site_count: 0, plan_code: "free", billing_status: "trialing", trial_ends_at: "2026-10-25T00:00:00Z" }), now);
    expect(health).toMatchObject({ kind: "setup", needsFollowUp: true });
  });

  it("does not chase a company created a few hours ago", () => {
    const health = classifyOrgHealth(row({ site_count: 0, created_at: "2026-10-17T09:00:00Z" }), now);
    expect(health).toMatchObject({ kind: "setup", needsFollowUp: false });
  });

  it("flags trials about to end", () => {
    const health = classifyOrgHealth(row({ plan_code: "free", billing_status: "trialing", trial_ends_at: "2026-10-19T00:00:00Z" }), now);
    expect(health.kind).toBe("trial_ending");
    expect(health.label).toBe("お試し残り2日");
  });

  it("flags companies idle for a week", () => {
    const health = classifyOrgHealth(row({ last_activity_at: "2026-10-08T00:00:00Z", schedules_7d: 0 }), now);
    expect(health).toMatchObject({ kind: "inactive", needsFollowUp: true, label: "9日 使われていない" });
  });

  it("flags pending cancellations", () => {
    expect(classifyOrgHealth(row({ cancel_at_period_end: true }), now).kind).toBe("canceling");
  });

  it("treats expired trials as lost", () => {
    const health = classifyOrgHealth(row({ plan_code: "free", billing_status: "trialing", trial_ends_at: "2026-10-01T00:00:00Z" }), now);
    expect(health).toMatchObject({ kind: "lost", needsFollowUp: false });
  });
});

describe("summarizeOverview", () => {
  it("counts paying, trial and follow-up companies", () => {
    const summary = summarizeOverview(
      [
        row(),
        row({ organization_id: "2", plan_code: "free", billing_status: "trialing", trial_ends_at: "2026-10-30T00:00:00Z" }),
        row({ organization_id: "3", billing_status: "past_due" }),
      ],
      18_000,
      now,
    );
    expect(summary).toEqual({ total: 3, paying: 1, trial: 1, followUp: 1, monthlyRevenueJpy: 18_000 });
  });
});

describe("isPlatformAdminEmail", () => {
  it("matches the allow list case-insensitively", () => {
    expect(isPlatformAdminEmail("Owner@Example.jp", " owner@example.jp, b@example.jp ")).toBe(true);
    expect(isPlatformAdminEmail("x@example.jp", "owner@example.jp")).toBe(false);
    expect(isPlatformAdminEmail("owner@example.jp", "")).toBe(false);
    expect(isPlatformAdminEmail(undefined, "owner@example.jp")).toBe(false);
  });
});

describe("describeOrgSource", () => {
  it("shows the sales-sheet code for form outreach", () => {
    expect(
      describeOrgSource({ organization_id: "o", utm_source: "form", utm_medium: "outbound", utm_campaign: null, utm_content: "AB3CD" }),
    ).toEqual({ label: "フォーム営業", code: "AB3CD", fromForm: true });
  });

  it("falls back to unknown when nothing was recorded", () => {
    expect(describeOrgSource(undefined)).toEqual({ label: "不明（直接・検索など）", code: null, fromForm: false });
  });

  it("names other sources with their medium and campaign", () => {
    expect(
      describeOrgSource({ organization_id: "o", utm_source: "youtube", utm_medium: "video", utm_campaign: "photos", utm_content: null }).label,
    ).toBe("youtube（video / photos）");
  });
});
