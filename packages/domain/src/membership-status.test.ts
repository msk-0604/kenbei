import { describe, expect, it } from "vitest";
import { canChangeMembershipStatus } from "./membership-status";

describe("membership disable guards", () => {
  it("blocks self-disable", () => {
    expect(
      canChangeMembershipStatus({
        actorProfileId: "me",
        targetProfileId: "me",
        nextStatus: "disabled",
        targetHasOrgManage: false,
        remainingOtherOrgManagers: 2,
      }),
    ).toEqual({ ok: false, reason: "self" });
  });

  it("blocks disabling the last org manager", () => {
    expect(
      canChangeMembershipStatus({
        actorProfileId: "admin",
        targetProfileId: "owner",
        nextStatus: "disabled",
        targetHasOrgManage: true,
        remainingOtherOrgManagers: 0,
      }),
    ).toEqual({ ok: false, reason: "last_manager" });
  });

  it("10. blocks disabling the last owner", () => {
    expect(
      canChangeMembershipStatus({
        actorProfileId: "manager",
        targetProfileId: "owner",
        nextStatus: "disabled",
        targetHasOrgManage: true,
        remainingOtherOrgManagers: 0,
        targetIsOwner: true,
        remainingOtherOwners: 0,
      }),
    ).toEqual({ ok: false, reason: "last_owner" });
  });

  it("rejects status changes in another organization", () => {
    expect(
      canChangeMembershipStatus({
        actorProfileId: "admin",
        targetProfileId: "other",
        nextStatus: "disabled",
        targetHasOrgManage: false,
        remainingOtherOrgManagers: 1,
        actorOrganizationId: "org-a",
        targetOrganizationId: "org-b",
      }),
    ).toEqual({ ok: false, reason: "cross_org" });
  });

  it("allows disabling a worker and re-enabling", () => {
    expect(
      canChangeMembershipStatus({
        actorProfileId: "admin",
        targetProfileId: "worker",
        nextStatus: "disabled",
        targetHasOrgManage: false,
        remainingOtherOrgManagers: 0,
      }),
    ).toEqual({ ok: true });
    expect(
      canChangeMembershipStatus({
        actorProfileId: "admin",
        targetProfileId: "admin",
        nextStatus: "active",
        targetHasOrgManage: true,
        remainingOtherOrgManagers: 0,
      }),
    ).toEqual({ ok: true });
  });
});
