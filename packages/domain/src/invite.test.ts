import { describe, expect, it } from "vitest";
import {
  acceptInviteRpcArgs,
  alreadyInCompanyMessage,
  blockedByOtherOrganization,
  canCancelInvite,
  inviteCancelUpdate,
  canAcceptInvite,
  extraInvitePreviewKeys,
  inviteEmailMatches,
  inviteRequiresEmailMatch,
  inviteRoleLabel,
  isInviteRoleCode,
} from "./invite";

describe("link invite rules", () => {
  it("creates new invites without email match", () => {
    expect(inviteRequiresEmailMatch(null)).toBe(false);
    expect(inviteEmailMatches(null, "anyone@example.com")).toBe(true);
  });

  it("lets any logged-in user accept a new invite", () => {
    expect(
      canAcceptInvite({
        tokenFound: true,
        used: false,
        expired: false,
        deleted: false,
        inviteEmail: null,
        userEmail: "tanaka@example.com",
        activeOrganizationIds: [],
        inviteOrganizationId: "org-a",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a used token", () => {
    expect(
      canAcceptInvite({
        tokenFound: true,
        used: true,
        expired: false,
        deleted: false,
        inviteEmail: null,
        userEmail: "tanaka@example.com",
        activeOrganizationIds: [],
        inviteOrganizationId: "org-a",
      }),
    ).toEqual({ ok: false, reason: "used" });
  });

  it("rejects an expired token", () => {
    expect(
      canAcceptInvite({
        tokenFound: true,
        used: false,
        expired: true,
        deleted: false,
        inviteEmail: null,
        userEmail: "tanaka@example.com",
        activeOrganizationIds: [],
        inviteOrganizationId: "org-a",
      }),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("keeps email match required for old invites", () => {
    expect(inviteRequiresEmailMatch("old@example.com")).toBe(true);
    expect(inviteEmailMatches("old@example.com", "old@example.com")).toBe(true);
    expect(
      canAcceptInvite({
        tokenFound: true,
        used: false,
        expired: false,
        deleted: false,
        inviteEmail: "old@example.com",
        userEmail: "old@example.com",
        activeOrganizationIds: [],
        inviteOrganizationId: "org-a",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects old invites when the email differs", () => {
    expect(inviteEmailMatches("old@example.com", "other@example.com")).toBe(false);
    expect(
      canAcceptInvite({
        tokenFound: true,
        used: false,
        expired: false,
        deleted: false,
        inviteEmail: "old@example.com",
        userEmail: "other@example.com",
        activeOrganizationIds: [],
        inviteOrganizationId: "org-a",
      }),
    ).toEqual({ ok: false, reason: "email" });
  });

  it("rejects a user who already belongs to another company", () => {
    expect(blockedByOtherOrganization(["org-b"], "org-a")).toBe(true);
    expect(
      canAcceptInvite({
        tokenFound: true,
        used: false,
        expired: false,
        deleted: false,
        inviteEmail: null,
        userEmail: "tanaka@example.com",
        activeOrganizationIds: ["org-b"],
        inviteOrganizationId: "org-a",
      }),
    ).toEqual({ ok: false, reason: "other_org" });
    expect(alreadyInCompanyMessage("Stark Lab")).toContain("Stark Lab");
  });

  it("does not send org or role in accept RPC args", () => {
    expect(acceptInviteRpcArgs("abc")).toEqual({ p_token: "abc" });
    expect(acceptInviteRpcArgs("abc")).not.toHaveProperty("organization_id");
    expect(acceptInviteRpcArgs("abc")).not.toHaveProperty("role_id");
  });

  it("does not allow owner invites from the invite role list", () => {
    expect(isInviteRoleCode("owner")).toBe(false);
    expect(isInviteRoleCode("worker")).toBe(true);
    expect(isInviteRoleCode("supervisor")).toBe(true);
    expect(isInviteRoleCode("manager")).toBe(true);
  });

  it("hides unused preview fields", () => {
    expect(
      extraInvitePreviewKeys({
        company_name: "A建設",
        role_label: "現場管理者",
        invite_state: "ok",
        organization_id: "secret",
        role_id: "secret",
        email: "secret",
      }),
    ).toEqual(["organization_id", "role_id", "email"]);
  });

  it("uses Japanese role labels", () => {
    expect(inviteRoleLabel("worker")).toBe("一般メンバー");
    expect(inviteRoleLabel("supervisor")).toBe("現場管理者");
    expect(inviteRoleLabel("manager")).toBe("管理者");
  });

  it("cancels only unused invites in the same company", () => {
    expect(
      canCancelInvite({
        sessionOrganizationId: "org-a",
        inviteOrganizationId: "org-a",
        accepted: false,
        alreadyDeleted: false,
      }),
    ).toEqual({ ok: true });
    expect(
      canCancelInvite({
        sessionOrganizationId: "org-a",
        inviteOrganizationId: "org-b",
        accepted: false,
        alreadyDeleted: false,
      }),
    ).toEqual({ ok: false, reason: "other_org" });
    expect(
      canCancelInvite({
        sessionOrganizationId: "org-a",
        inviteOrganizationId: "org-a",
        accepted: true,
        alreadyDeleted: false,
      }),
    ).toEqual({ ok: false, reason: "used" });
    expect(inviteCancelUpdate("2026-09-22T00:00:00.000Z")).toEqual({ deleted_at: "2026-09-22T00:00:00.000Z" });
    expect(inviteCancelUpdate("2026-09-22T00:00:00.000Z")).not.toHaveProperty("accepted_at");
  });

  it("treats a canceled invite as unusable", () => {
    expect(
      canAcceptInvite({
        tokenFound: true,
        used: false,
        expired: false,
        deleted: true,
        inviteEmail: null,
        userEmail: "tanaka@example.com",
        activeOrganizationIds: [],
        inviteOrganizationId: "org-a",
      }),
    ).toEqual({ ok: false, reason: "missing" });
  });
});
