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
