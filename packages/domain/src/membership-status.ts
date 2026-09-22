export type MembershipLifecycleStatus = "active" | "disabled";

export type MembershipStatusChangeInput = {
  actorProfileId: string;
  targetProfileId: string;
  nextStatus: MembershipLifecycleStatus;
  targetHasOrgManage: boolean;
  remainingOtherOrgManagers: number;
  targetIsOwner?: boolean;
  remainingOtherOwners?: number;
  actorOrganizationId?: string;
  targetOrganizationId?: string;
};

export type MembershipStatusChangeResult =
  | { ok: true }
  | { ok: false; reason: "self" | "last_manager" | "last_owner" | "cross_org" };

export function canChangeMembershipStatus(
  input: MembershipStatusChangeInput,
): MembershipStatusChangeResult {
  if (
    input.actorOrganizationId &&
    input.targetOrganizationId &&
    input.actorOrganizationId !== input.targetOrganizationId
  ) {
    return { ok: false, reason: "cross_org" };
  }
  if (input.nextStatus === "disabled" && input.actorProfileId === input.targetProfileId) {
    return { ok: false, reason: "self" };
  }
  if (
    input.nextStatus === "disabled" &&
    input.targetIsOwner &&
    (input.remainingOtherOwners ?? 0) <= 0
  ) {
    return { ok: false, reason: "last_owner" };
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

export function membershipStatusChangeError(
  reason: "self" | "last_manager" | "last_owner" | "cross_org",
): string {
  if (reason === "self") {
    return "自分自身は無効化できません。";
  }
  if (reason === "last_owner") {
    return "最後の代表は無効化できません。";
  }
  if (reason === "cross_org") {
    return "メンバーを変更する権限がありません。";
  }
  return "最後の管理者は無効化できません。";
}
