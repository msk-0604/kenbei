import { describe, expect, it } from "vitest";
import { isInviteRoleCode } from "./invite";
import {
  accountAdminLinks,
  activeMembershipCount,
  canCreateInviteWithRole,
  canMutateMembershipInOrganization,
  evaluateMembershipRoleWrite,
  memberFacingRoleLabel,
  pendingInviteCount,
} from "./membership-role";

function write(partial: Partial<Parameters<typeof evaluateMembershipRoleWrite>[0]>) {
  return evaluateMembershipRoleWrite({
    actorHasMemberManage: true,
    actorRole: "manager",
    targetCurrentRole: "worker",
    nextRole: "owner",
    remainingOtherOwners: 1,
    actorOrganizationId: "org-a",
    targetOrganizationId: "org-a",
    ...partial,
  });
}

describe("P0 membership role writes", () => {
  it("1. rejects worker self-escalation to owner", () => {
    expect(
      write({
        actorHasMemberManage: false,
        actorRole: "worker",
        targetCurrentRole: "worker",
        nextRole: "owner",
      }),
    ).toEqual({ ok: false, reason: "no_permission" });
  });

  it("2. rejects supervisor self-escalation to manager or owner", () => {
    expect(
      write({
        actorHasMemberManage: false,
        actorRole: "supervisor",
        targetCurrentRole: "supervisor",
        nextRole: "manager",
      }),
    ).toEqual({ ok: false, reason: "no_permission" });
    expect(
      write({
        actorHasMemberManage: false,
        actorRole: "supervisor",
        targetCurrentRole: "supervisor",
        nextRole: "owner",
      }),
    ).toEqual({ ok: false, reason: "no_permission" });
  });

  it("3. rejects manager self-escalation to owner", () => {
    expect(
      write({
        actorRole: "manager",
        targetCurrentRole: "manager",
        nextRole: "owner",
      }),
    ).toEqual({ ok: false, reason: "owner_grant" });
  });

  it("4. rejects manager promoting another member to owner", () => {
    expect(
      write({
        actorRole: "manager",
        targetCurrentRole: "worker",
        nextRole: "owner",
      }),
    ).toEqual({ ok: false, reason: "owner_grant" });
  });

  it("5-8. invite roles: owner denied, worker/supervisor/manager allowed", () => {
    expect(canCreateInviteWithRole("owner")).toBe(false);
    expect(canCreateInviteWithRole("executive")).toBe(false);
    expect(canCreateInviteWithRole("office")).toBe(false);
    expect(canCreateInviteWithRole("worker")).toBe(true);
    expect(canCreateInviteWithRole("supervisor")).toBe(true);
    expect(canCreateInviteWithRole("manager")).toBe(true);
    expect(isInviteRoleCode("owner")).toBe(false);
  });

  it("9. rejects demoting the last owner", () => {
    expect(
      write({
        actorRole: "owner",
        targetCurrentRole: "owner",
        nextRole: "manager",
        remainingOtherOwners: 0,
      }),
    ).toEqual({ ok: false, reason: "last_owner" });
    expect(
      write({
        actorRole: "owner",
        targetCurrentRole: "owner",
        nextRole: "worker",
        remainingOtherOwners: 0,
      }),
    ).toEqual({ ok: false, reason: "last_owner" });
  });

  it("11. rejects membership writes in another organization", () => {
    expect(
      write({
        actorOrganizationId: "org-a",
        targetOrganizationId: "org-b",
      }),
    ).toEqual({ ok: false, reason: "cross_org" });
    expect(canMutateMembershipInOrganization("org-a", "org-b")).toBe(false);
    expect(canMutateMembershipInOrganization("org-a", "org-a")).toBe(true);
  });

  it("locks any remaining role change even among invite roles", () => {
    expect(
      write({
        targetCurrentRole: "worker",
        nextRole: "manager",
      }),
    ).toEqual({ ok: false, reason: "locked" });
  });
});

describe("member count and account links", () => {
  it("13-14. counts only active memberships and keeps pending invites separate", () => {
    expect(
      activeMembershipCount([
        { status: "active" },
        { status: "active" },
        { status: "disabled" },
      ]),
    ).toBe(2);
    expect(
      pendingInviteCount([
        { acceptedAt: null },
        { acceptedAt: "2026-01-01" },
        { acceptedAt: null, deletedAt: "2026-01-02" },
      ]),
    ).toBe(1);
  });

  it("15. hides billing from worker and supervisor", () => {
    expect(accountAdminLinks({ orgManage: false, memberManage: false })).toEqual({
      memberManage: false,
      billing: false,
      companySettings: false,
      dataExport: false,
    });
    expect(accountAdminLinks({ orgManage: false, memberManage: true })).toEqual({
      memberManage: true,
      billing: false,
      companySettings: false,
      dataExport: false,
    });
    expect(accountAdminLinks({ orgManage: true, memberManage: true }).billing).toBe(true);
  });

  it("uses user-facing role labels", () => {
    expect(memberFacingRoleLabel("owner")).toBe("代表");
    expect(memberFacingRoleLabel("manager")).toBe("管理者");
    expect(memberFacingRoleLabel("supervisor")).toBe("現場管理者");
    expect(memberFacingRoleLabel("worker")).toBe("一般メンバー");
  });
});
