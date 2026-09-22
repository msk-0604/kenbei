import { describe, expect, it } from "vitest";
import {
  acceptInviteRpcArgs,
  alreadyInCompanyMessage,
  blockedByOtherOrganization,
  canCancelInvite,
  inviteCancelUpdate,
  canAcceptInvite,
  extraInvitePreviewKeys,
  inviteDuplicateEmailMessage,
  inviteEmailMatches,
  inviteEmailMismatchMessage,
  inviteJoinPath,
  inviteMailFailedMessage,
  inviteRequiresEmailMatch,
  inviteRoleLabel,
  isInviteRoleCode,
  isSafeInviteNextPath,
  normalizeInviteEmail,
  safeAuthNextPath,
  canResendInvite,
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
        email_state: "anon",
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

  it("11. rejects a different email on an email invite", () => {
    expect(inviteEmailMatches("a@company.jp", "b@company.jp")).toBe(false);
    expect(
      canAcceptInvite({
        tokenFound: true,
        used: false,
        expired: false,
        deleted: false,
        inviteEmail: "a@company.jp",
        userEmail: "b@company.jp",
        activeOrganizationIds: [],
        inviteOrganizationId: "org-a",
      }),
    ).toEqual({ ok: false, reason: "email" });
    expect(inviteEmailMismatchMessage()).toContain("別のメールアドレス");
  });

  it("12-14. rejects expired, canceled, and used invites", () => {
    expect(
      canAcceptInvite({
        tokenFound: true,
        used: false,
        expired: true,
        deleted: false,
        inviteEmail: "a@company.jp",
        userEmail: "a@company.jp",
        activeOrganizationIds: [],
        inviteOrganizationId: "org-a",
      }),
    ).toEqual({ ok: false, reason: "expired" });
    expect(
      canAcceptInvite({
        tokenFound: true,
        used: false,
        expired: false,
        deleted: true,
        inviteEmail: "a@company.jp",
        userEmail: "a@company.jp",
        activeOrganizationIds: [],
        inviteOrganizationId: "org-a",
      }),
    ).toEqual({ ok: false, reason: "missing" });
    expect(
      canAcceptInvite({
        tokenFound: true,
        used: true,
        expired: false,
        deleted: false,
        inviteEmail: "a@company.jp",
        userEmail: "a@company.jp",
        activeOrganizationIds: [],
        inviteOrganizationId: "org-a",
      }),
    ).toEqual({ ok: false, reason: "used" });
  });

  it("keeps confirmation and login return paths on the join token", () => {
    expect(inviteJoinPath("tokentokentokentokentokentoken12")).toBe("/join?token=tokentokentokentokentokentoken12");
    expect(isSafeInviteNextPath("/join?token=abc123abc123abc123abc123abc123ab")).toBe(true);
    expect(isSafeInviteNextPath("https://evil.example/join?token=abc")).toBe(false);
    expect(isSafeInviteNextPath("//evil/join?token=abc")).toBe(false);
    expect(safeAuthNextPath("/join?token=abc123abc123abc123abc123abc123ab")).toBe(
      "/join?token=abc123abc123abc123abc123abc123ab",
    );
    expect(safeAuthNextPath("https://app.kenbei.jp/join?token=x")).toBe("");
    expect(normalizeInviteEmail(" Example@Company.JP ")).toBe("example@company.jp");
    expect(normalizeInviteEmail("not-an-email")).toBeNull();
    expect(inviteMailFailedMessage()).toContain("メールを送信できませんでした");
    expect(inviteDuplicateEmailMessage()).toContain("すでに招待中");
    expect(
      canResendInvite({
        sessionOrganizationId: "org-a",
        inviteOrganizationId: "org-a",
        accepted: false,
        alreadyDeleted: false,
        email: "a@company.jp",
      }),
    ).toEqual({ ok: true });
    expect(
      canResendInvite({
        sessionOrganizationId: "org-a",
        inviteOrganizationId: "org-b",
        accepted: false,
        alreadyDeleted: false,
        email: "a@company.jp",
      }),
    ).toEqual({ ok: false, reason: "other_org" });
  });
});
