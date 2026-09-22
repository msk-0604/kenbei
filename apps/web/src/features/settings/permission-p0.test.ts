import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  accountAdminLinks,
  activeMembershipCount,
  canCancelInvite,
  canCreateInviteWithRole,
  canMutateMembershipInOrganization,
  evaluateMembershipRoleWrite,
  pendingInviteCount,
} from "@kensapo/domain";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260922140000_protect_membership_roles.sql"),
  "utf8",
);
const actions = readFileSync(resolve(process.cwd(), "apps/web/src/features/settings/actions.ts"), "utf8");
const settingsPage = readFileSync(resolve(process.cwd(), "apps/web/src/app/settings/page.tsx"), "utf8");
const accountPage = readFileSync(resolve(process.cwd(), "apps/web/src/app/account/page.tsx"), "utf8");

describe("P0 permission migration", () => {
  it("blocks role writes, owner invites, and last-owner removal", () => {
    expect(sql).toMatch(/KENBEI_ROLE_LOCKED/);
    expect(sql).toMatch(/KENBEI_OWNER_GRANT/);
    expect(sql).toMatch(/KENBEI_INVITE_ROLE/);
    expect(sql).toMatch(/KENBEI_LAST_OWNER/);
    expect(sql).toMatch(/KENBEI_ORG_MISMATCH/);
    expect(sql).toMatch(/r\.code IN \('worker', 'supervisor', 'manager'\)/);
    expect(sql).toMatch(/IF NOT public\.invite_role_is_allowed\(v_invite\.role_id\)/);
    expect(sql).toMatch(/SET status = 'active'/);
    expect(sql).not.toMatch(/SET role_id = v_invite\.role_id/);
    expect(sql).not.toMatch(/CREATE\s+POLICY/i);
    expect(sql).not.toMatch(/DROP\s+POLICY/i);
    expect(sql).not.toMatch(/service_role/i);
    expect(sql).not.toMatch(/billing_plans/i);
    expect(sql).not.toMatch(/organization_billing/i);
    expect(sql).not.toMatch(/stripe/i);
  });
});

describe("P0 server-side actions", () => {
  it("requires org.manage for company settings and invite allow-list for roles", () => {
    expect(actions).toMatch(
      /if \(!can\(workspace, "org\.manage"\)\) \{\s*return \{ error: "設定を変更する権限がありません。"/s,
    );
    expect(actions).toMatch(/isInviteRoleCode\(roleCode\)/);
    expect(actions).toMatch(/canMutateMembershipInOrganization\(workspace\.organizationId, targetOrgId\)/);
    expect(actions).toMatch(/KENBEI_LAST_OWNER/);
    expect(actions).toMatch(/KENBEI_INVITE_ROLE/);
  });

  it("12. cancels invites only in the session organization", () => {
    expect(canCancelInvite({
      sessionOrganizationId: "org-a",
      inviteOrganizationId: "org-b",
      accepted: false,
      alreadyDeleted: false,
    })).toEqual({ ok: false, reason: "other_org" });
    expect(actions).toMatch(/\.eq\("organization_id", workspace\.organizationId\)/);
  });
});

describe("P0 UI gates", () => {
  it("counts active members only and keeps pending invites separate", () => {
    expect(settingsPage).toMatch(/activeMembershipCount\(members\)/);
    expect(settingsPage).toMatch(/招待中/);
    expect(settingsPage).toMatch(/canEditCompany \?/);
    expect(accountPage).toMatch(/accountAdminLinks/);
    expect(accountPage).toMatch(/メンバー管理/);
    expect(accountPage).not.toMatch(/ROLE_MAP/);
  });

  it("15. does not show billing to workers or supervisors", () => {
    expect(accountAdminLinks({ orgManage: false, memberManage: false }).billing).toBe(false);
    expect(pendingInviteCount([{ acceptedAt: null }])).toBe(1);
    expect(activeMembershipCount([{ status: "active" }, { status: "disabled" }])).toBe(1);
    expect(canCreateInviteWithRole("owner")).toBe(false);
    expect(
      evaluateMembershipRoleWrite({
        actorHasMemberManage: true,
        actorRole: "manager",
        targetCurrentRole: "worker",
        nextRole: "owner",
        remainingOtherOwners: 1,
        actorOrganizationId: "org-a",
        targetOrganizationId: "org-a",
      }),
    ).toEqual({ ok: false, reason: "owner_grant" });
    expect(canMutateMembershipInOrganization("org-a", "org-b")).toBe(false);
  });
});
