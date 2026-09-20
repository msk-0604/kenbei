import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("checkout stays available during trial", () => {
  it("does not add Stripe trial_period_days and does not write-lock billing actions", () => {
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/features/billing/actions.ts"), "utf8");
    expect(src).not.toMatch(/trial_period_days/);
    expect(src).not.toMatch(/assertOrganizationWritable/);
    expect(src).toMatch(/org\.manage/);
  });
});
