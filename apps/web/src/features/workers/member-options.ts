import "server-only";

import { CREW_ROLE_CODE } from "@kensapo/domain";
import { listOrgMembers } from "@/features/projects/queries";
import type { MemberOption } from "@/features/workers/worker-form";

/** 作業員名簿に紐づけられる個人アカウント（共通ログインは除く） */
export async function workerMemberOptions(): Promise<MemberOption[]> {
  const members = await listOrgMembers();
  return members
    .filter((member) => member.roleCode !== CREW_ROLE_CODE)
    .map((member) => ({ membershipId: member.membershipId, displayName: member.displayName }));
}
