import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extraInvitePreviewKeys, isInviteRoleCode } from "@kensapo/domain";
import { firstInvitePreview } from "./invite-preview";
import { newInviteInsertFields } from "./invite-insert";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260922120000_link_invites.sql"),
  "utf8",
);

describe("new link invite insert", () => {
  it("creates email-null invite rows from the session organization only", () => {
    expect(
      newInviteInsertFields({
        organizationId: "org-from-session",
        roleId: "role-from-server",
        token: "tok",
        invitedBy: "user-1",
        expiresAt: "2026-10-01T00:00:00.000Z",
      }),
    ).toEqual({
      organization_id: "org-from-session",
      email: null,
      role_id: "role-from-server",
      token: "tok",
      invited_by: "user-1",
      expires_at: "2026-10-01T00:00:00.000Z",
    });
  });

  it("does not allow a general member role code to be treated as an invite-creator role", () => {
    expect(isInviteRoleCode("worker")).toBe(true);
  });
});

describe("invite preview payload", () => {
  it("reads company name for an anonymous preview", () => {
    const row = firstInvitePreview([
      { company_name: "A建設株式会社", role_label: "現場管理者", invite_state: "ok" },
    ]);
    expect(row?.company_name).toBe("A建設株式会社");
    expect(row?.role_label).toBe("現場管理者");
    expect(row?.invite_state).toBe("ok");
  });

  it("does not keep extra preview fields", () => {
    expect(
      extraInvitePreviewKeys({
        company_name: "A建設株式会社",
        role_label: "現場管理者",
        invite_state: "ok",
      }),
    ).toEqual([]);
  });
});

describe("link invite migration", () => {
  it("keeps old email invites and does not rewrite billing or seats", () => {
    expect(sql).toMatch(/ALTER COLUMN email DROP NOT NULL/i);
    expect(sql).toMatch(/v_invite\.email IS NOT NULL AND lower\(v_invite\.email\) <> v_email/);
    expect(sql).toMatch(/KENBEI_ALREADY_IN_ORG/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(sql).toMatch(/accepted_at IS NULL/);
    expect(sql).toMatch(/expires_at > now\(\)/);
    expect(sql).toMatch(/preview_organization_invite/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.preview_organization_invite\(text\) TO anon, authenticated/);
    expect(sql).toMatch(/v_invite\.organization_id/);
    expect(sql).toMatch(/v_invite\.role_id/);
    expect(sql).not.toMatch(/UPDATE\s+public\.organization_invitations\s+SET\s+email/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+public\.organization_invitations/i);
    expect(sql).not.toMatch(/billing_plans/i);
    expect(sql).not.toMatch(/organization_seat_limit/i);
    expect(sql).not.toMatch(/organization_billing/i);
    expect(sql).not.toMatch(/interval\s+'14\s+days'/i);
    expect(sql).not.toMatch(/CREATE\s+POLICY/i);
    expect(sql).not.toMatch(/service_role/i);
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
    expect(sql).not.toMatch(/stripe/i);
  });
});
