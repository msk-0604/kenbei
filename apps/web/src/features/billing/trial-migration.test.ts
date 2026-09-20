import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260919120000_app_owned_14_day_trial.sql"),
  "utf8",
);

describe("app-owned 14-day trial migration", () => {
  it("creates trialing rows for new orgs without rewriting existing billing", () => {
    expect(sql).toMatch(/plan_code,\s*status,\s*trial_ends_at/);
    expect(sql).toMatch(/'free',\s*'trialing',\s*now\(\) \+ interval '14 days'/);
    expect(sql).not.toMatch(/UPDATE\s+public\.organization_billing/i);
    expect(sql).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(sql).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(sql).not.toMatch(/CREATE\s+POLICY/i);
    expect(sql).not.toMatch(/service_role/i);
    expect(sql).not.toMatch(/GRANT\s+.*TO\s+authenticated/i);
  });
});
