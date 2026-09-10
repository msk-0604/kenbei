export type MembershipLifecycleStatus = "active" | "disabled";

export type MembershipStatusChangeInput = {
  actorProfileId: string;
  targetProfileId: string;
  nextStatus: MembershipLifecycleStatus;
  targetHasOrgManage: boolean;
  remainingOtherOrgManagers: number;
};

export type MembershipStatusChangeResult =
  | { ok: true }
  | { ok: false; reason: "self" | "last_manager" };

export function canChangeMembershipStatus(
  input: MembershipStatusChangeInput,
): MembershipStatusChangeResult {
  if (input.nextStatus === "disabled" && input.actorProfileId === input.targetProfileId) {
    return { ok: false, reason: "self" };
  }
  if (
    input.nextStatus === "disabled" &&
    input.targetHasOrgManage &&
    input.remainingOtherOrgManagers <= 0
  ) {
    return { ok: false, reason: "last_manager" };
  }
  return { ok: true };
}

export function membershipStatusChangeError(reason: "self" | "last_manager"): string {
  if (reason === "self") {
    return "自分自身は無効化できません。";
  }
  return "最後の管理者は無効化できません。";
}
