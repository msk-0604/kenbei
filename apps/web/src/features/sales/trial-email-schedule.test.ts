import { describe, expect, it } from "vitest";
import { dueTrialEmailKinds } from "./trial-email-schedule";
import { canRetryTrialEmail, nextTrialEmailRetryAt, TRIAL_EMAIL_MAX_ATTEMPTS } from "./trial-email-retry";
import { trialEmailCopy } from "./trial-email-copy";
import { isMissingSalesTable, isUniqueSalesConstraint } from "./missing-table";

describe("trial email schedule", () => {
  const trialEndsAt = new Date("2026-10-15T00:00:00.000Z");

  it("sends start immediately, day 3 after three days, and ending two days before expiry", () => {
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-10-01T00:00:00.000Z"),
        trialEndsAt,
        status: "trialing",
        sentKinds: [],
      }),
    ).toEqual(["trial_started"]);
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-10-04T00:00:00.000Z"),
        trialEndsAt,
        status: "trialing",
        sentKinds: ["trial_started"],
      }),
    ).toEqual(["trial_day3"]);
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-10-13T00:00:00.000Z"),
        trialEndsAt,
        status: "trialing",
        sentKinds: ["trial_started", "trial_day3"],
      }),
    ).toEqual(["trial_ending_soon"]);
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-10-16T00:00:00.000Z"),
        trialEndsAt,
        status: "trialing",
        sentKinds: ["trial_started"],
      }),
    ).toEqual([]);
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-10-04T00:00:00.000Z"),
        trialEndsAt,
        status: "active",
        sentKinds: [],
      }),
    ).toEqual([]);
  });

  it("does not backfill past lifecycle mails for an existing mid-trial company", () => {
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-09-27T12:00:00.000Z"),
        trialEndsAt: new Date("2026-10-04T09:57:32.000Z"),
        status: "trialing",
        sentKinds: [],
      }),
    ).toEqual([]);
  });

  it("never mails organizations whose trial started before 2026-09-28 JST", () => {
    const existingEndsAt = new Date("2026-10-04T09:57:32.000Z");
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-09-20T09:57:32.000Z"),
        trialEndsAt: existingEndsAt,
        status: "trialing",
        sentKinds: [],
      }),
    ).toEqual([]);
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-10-02T09:57:32.000Z"),
        trialEndsAt: existingEndsAt,
        status: "trialing",
        sentKinds: [],
      }),
    ).toEqual([]);
    const justBeforeCutoffEnds = new Date("2026-10-11T14:59:59.999Z");
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-09-27T14:59:59.999Z"),
        trialEndsAt: justBeforeCutoffEnds,
        status: "trialing",
        sentKinds: [],
      }),
    ).toEqual([]);
  });

  it("mails organizations whose trial started on or after 2026-09-28 JST", () => {
    const cohortEndsAt = new Date("2026-10-11T15:00:00.000Z");
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-09-27T15:00:00.000Z"),
        trialEndsAt: cohortEndsAt,
        status: "trialing",
        sentKinds: [],
      }),
    ).toEqual(["trial_started"]);
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-09-30T15:00:00.000Z"),
        trialEndsAt: cohortEndsAt,
        status: "trialing",
        sentKinds: ["trial_started"],
      }),
    ).toEqual(["trial_day3"]);
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-10-09T15:00:00.000Z"),
        trialEndsAt: cohortEndsAt,
        status: "trialing",
        sentKinds: ["trial_started", "trial_day3"],
      }),
    ).toEqual(["trial_ending_soon"]);
  });

  it("still schedules all three windows for a newly registered company", () => {
    const trialEndsAt = new Date("2026-10-15T00:00:00.000Z");
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-10-01T12:00:00.000Z"),
        trialEndsAt,
        status: "trialing",
        sentKinds: [],
      }),
    ).toEqual(["trial_started"]);
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-10-04T12:00:00.000Z"),
        trialEndsAt,
        status: "trialing",
        sentKinds: ["trial_started"],
      }),
    ).toEqual(["trial_day3"]);
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-10-13T12:00:00.000Z"),
        trialEndsAt,
        status: "trialing",
        sentKinds: ["trial_started", "trial_day3"],
      }),
    ).toEqual(["trial_ending_soon"]);
  });

  it("does not queue a late start or day-3 mail after those windows close", () => {
    expect(
      dueTrialEmailKinds({
        now: new Date("2026-10-13T00:00:00.000Z"),
        trialEndsAt: new Date("2026-10-15T00:00:00.000Z"),
        status: "trialing",
        sentKinds: [],
      }),
    ).toEqual(["trial_ending_soon"]);
  });

  it("retries failed sends with backoff and stops after max attempts", () => {
    const now = new Date("2026-10-01T00:00:00.000Z");
    expect(canRetryTrialEmail({ status: "sent", attemptCount: 1, nextRetryAt: null, now })).toBe(false);
    expect(canRetryTrialEmail({ status: "failed", attemptCount: 1, nextRetryAt: now, now })).toBe(true);
    expect(
      canRetryTrialEmail({
        status: "failed",
        attemptCount: TRIAL_EMAIL_MAX_ATTEMPTS,
        nextRetryAt: now,
        now,
      }),
    ).toBe(false);
    expect(nextTrialEmailRetryAt(1, now).getTime()).toBe(now.getTime() + 15 * 60_000);
    expect(nextTrialEmailRetryAt(2, now).getTime()).toBe(now.getTime() + 30 * 60_000);
  });

  it("uses real KENBEI features and tax-inclusive prices", () => {
    const started = trialEmailCopy("trial_started", "https://app.kenbei.jp");
    expect(started.subject).toMatch(/14日間無料体験/);
    expect(started.text).toMatch(/現場ごとの写真/);
    expect(started.text).toMatch(/日報PDF/);
    expect(started.text).not.toMatch(/AI軍師/);
    expect(started.text).toMatch(/月額9,800円（税込/);
    expect(started.text).not.toMatch(/39,800|65,000|STANDARD|BUSINESS/);
    expect(started.text).toMatch(/settings\/billing/);
    expect(trialEmailCopy("trial_day3", "https://app.kenbei.jp").text).toMatch(/タスク/);
    expect(trialEmailCopy("trial_ending_soon", "https://app.kenbei.jp").text).toMatch(/自動課金しません/);
  });

  it("does not treat a unique violation as a missing table", () => {
    const unique = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "sales_funnel_events_visit_visitor_uidx"',
    };
    expect(isUniqueSalesConstraint(unique)).toBe(true);
    expect(isMissingSalesTable(unique)).toBe(false);
    expect(isMissingSalesTable({ code: "42P01", message: "relation does not exist" })).toBe(true);
  });
});
