import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260927120000_sales_funnel_and_trial_emails.sql"),
  "utf8",
);

describe("sales funnel and trial email migration", () => {
  it("adds history tables without changing billing or widening grants", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.sales_funnel_events/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.trial_lifecycle_emails/);
    expect(sql).toMatch(/PRIMARY KEY \(organization_id, kind\)/);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.sales_funnel_events FROM PUBLIC, anon, authenticated/);
    expect(sql).not.toMatch(/UPDATE\s+public\.organization_billing/i);
    expect(sql).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(sql).not.toMatch(/GRANT\s+.*TO\s+authenticated/i);
    expect(sql).not.toMatch(/CREATE\s+POLICY/i);
  });
});
