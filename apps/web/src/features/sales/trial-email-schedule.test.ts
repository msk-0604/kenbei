import { describe, expect, it } from "vitest";
import { dueTrialEmailKinds } from "./trial-email-schedule";
import { canRetryTrialEmail, nextTrialEmailRetryAt, TRIAL_EMAIL_MAX_ATTEMPTS } from "./trial-email-retry";
import { trialEmailCopy } from "./trial-email-copy";
import { isMissingSalesTable } from "./missing-table";

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
    expect(started.text).toMatch(/AI軍師/);
    expect(started.text).toMatch(/39,800円（税込/);
    expect(started.text).toMatch(/65,000円（税込/);
    expect(started.text).toMatch(/settings\/billing/);
    expect(trialEmailCopy("trial_day3", "https://app.kenbei.jp").text).toMatch(/タスク/);
    expect(trialEmailCopy("trial_ending_soon", "https://app.kenbei.jp").text).toMatch(/自動課金しません/);
  });

  it("treats a missing funnel table as skippable", () => {
    expect(isMissingSalesTable({ code: "42P01", message: "relation does not exist" })).toBe(true);
    expect(isMissingSalesTable({ code: "23505", message: "duplicate" })).toBe(false);
  });
});
