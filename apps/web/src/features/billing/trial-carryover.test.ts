import { describe, expect, it } from "vitest";
import { MIN_TRIAL_CARRYOVER_MS, trialCarryoverEnd } from "./trial-carryover";

describe("trialCarryoverEnd", () => {
  const now = new Date("2026-10-18T00:00:00Z");

  it("starts billing at the end of a running trial", () => {
    expect(trialCarryoverEnd({ status: "trialing", trial_ends_at: "2026-10-30T00:00:00Z" }, now)).toBe(
      Math.floor(new Date("2026-10-30T00:00:00Z").getTime() / 1000),
    );
  });

  it("bills from today when the trial is over, almost over, or absent", () => {
    expect(trialCarryoverEnd({ status: "trialing", trial_ends_at: "2026-10-10T00:00:00Z" }, now)).toBeNull();
    const soon = new Date(now.getTime() + MIN_TRIAL_CARRYOVER_MS - 60_000).toISOString();
    expect(trialCarryoverEnd({ status: "trialing", trial_ends_at: soon }, now)).toBeNull();
    expect(trialCarryoverEnd({ status: "canceled", trial_ends_at: "2026-10-30T00:00:00Z" }, now)).toBeNull();
    expect(trialCarryoverEnd({ status: "trialing", trial_ends_at: null }, now)).toBeNull();
    expect(trialCarryoverEnd(null, now)).toBeNull();
  });
});
