import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inviteJoinUrl, isInviteRoleCode, isSafeInviteNextPath } from "@kensapo/domain";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260922150000_invite_email_preview.sql"),
  "utf8",
);
const invitedEmailSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260922160000_invite_preview_invited_email.sql"),
  "utf8",
);
const p0 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260922140000_protect_membership_roles.sql"),
  "utf8",
);

describe("email invite migration", () => {
  it("adds preview email_state without weakening RLS or P0", () => {
    expect(sql).toMatch(/email_state/);
    expect(sql).toMatch(/mismatch/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.preview_organization_invite\(text\) TO anon, authenticated/);
    expect(sql).not.toMatch(/CREATE\s+POLICY/i);
    expect(sql).not.toMatch(/DROP\s+POLICY/i);
    expect(sql).not.toMatch(/service_role/i);
    expect(sql).not.toMatch(/billing_plans/i);
    expect(sql).not.toMatch(/stripe/i);
    expect(p0).toMatch(/KENBEI_INVITE_ROLE/);
    expect(p0).toMatch(/r\.code IN \('worker', 'supervisor', 'manager'\)/);
    expect(invitedEmailSql).toMatch(/invited_email/);
    expect(invitedEmailSql).not.toMatch(/CREATE\s+POLICY/i);
  });

  it("15. still rejects owner invite roles", () => {
    expect(isInviteRoleCode("owner")).toBe(false);
  });

  it("3. keeps the existing join URL", () => {
    expect(inviteJoinUrl("https://app.kenbei.jp", "abc123abc123abc123abc123abc123ab")).toBe(
      "https://app.kenbei.jp/join?token=abc123abc123abc123abc123abc123ab",
    );
    expect(isSafeInviteNextPath("/join?token=abc123abc123abc123abc123abc123ab")).toBe(true);
  });
});
