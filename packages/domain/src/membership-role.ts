import { isInviteRoleCode } from "./invite";

export type MembershipRoleWriteInput = {
  actorHasMemberManage: boolean;
  actorRole: string;
  targetCurrentRole: string;
  nextRole: string;
  remainingOtherOwners: number;
  actorOrganizationId: string;
  targetOrganizationId: string;
};

export type MembershipRoleWriteResult =
  | { ok: true }
  | {
      ok: false;
      reason: "cross_org" | "last_owner" | "owner_grant" | "forbidden_role" | "locked" | "no_permission";
    };

export function canChangeMembershipRole(_input: MembershipRoleWriteInput): MembershipRoleWriteResult {
  return evaluateMembershipRoleWrite(_input);
}

export function evaluateMembershipRoleWrite(input: MembershipRoleWriteInput): MembershipRoleWriteResult {
  if (input.actorOrganizationId !== input.targetOrganizationId) {
    return { ok: false, reason: "cross_org" };
  }
  if (!input.actorHasMemberManage) {
    return { ok: false, reason: "no_permission" };
  }
  if (input.targetCurrentRole === input.nextRole) {
    return { ok: true };
  }
  if (input.targetCurrentRole === "owner" && input.remainingOtherOwners <= 0) {
    return { ok: false, reason: "last_owner" };
  }
  if (input.nextRole === "owner") {
    return { ok: false, reason: "owner_grant" };
  }
  if (!isInviteRoleCode(input.nextRole)) {
    return { ok: false, reason: "forbidden_role" };
  }
  return { ok: false, reason: "locked" };
}

export function canCreateInviteWithRole(roleCode: string): boolean {
  return isInviteRoleCode(roleCode);
}

export function canMutateMembershipInOrganization(
  sessionOrganizationId: string,
  targetOrganizationId: string,
): boolean {
  return Boolean(sessionOrganizationId) && sessionOrganizationId === targetOrganizationId;
}

export function activeMembershipCount(members: readonly { status: string }[]): number {
  return members.filter((member) => member.status === "active").length;
}

export function pendingInviteCount(
  invites: readonly { acceptedAt: string | null; deletedAt?: string | null }[],
): number {
  return invites.filter((invite) => !invite.acceptedAt && !invite.deletedAt).length;
}

export function accountAdminLinks(input: { orgManage: boolean; memberManage: boolean }): {
  memberManage: boolean;
  billing: boolean;
  companySettings: boolean;
  dataExport: boolean;
} {
  return {
    memberManage: input.memberManage,
    billing: input.orgManage,
    companySettings: input.orgManage,
    dataExport: input.orgManage,
  };
}

export function memberFacingRoleLabel(code: string | null | undefined): string {
  if (code === "executive") {
    return "管理者";
  }
  if (code === "worker") {
    return "一般メンバー";
  }
  if (code === "owner") {
    return "代表";
  }
  if (code === "manager") {
    return "管理者";
  }
  if (code === "supervisor") {
    return "現場管理者";
  }
  if (code === "office") {
    return "事務";
  }
  if (code === "partner") {
    return "協力会社";
  }
  if (code === "guest") {
    return "ゲスト";
  }
  return "メンバー";
}
