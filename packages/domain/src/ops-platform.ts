export const OPS_SIGNAL_TYPES = [
  "overdue_task",
  "delayed_process",
  "pending_confirmation",
  "unconfirmed_report",
  "failed_upload",
  "overdue_approval",
] as const;

export type OpsSignalType = (typeof OPS_SIGNAL_TYPES)[number];

export type OpsSignalInput = {
  organizationId: string;
  projectId: string | null;
  type: OpsSignalType;
  severity: "low" | "medium" | "high";
  title: string;
  reason: string;
  source: string;
  refId?: string;
};

export function assertSameOrganization(rowOrgId: string, expectedOrgId: string): boolean {
  return Boolean(rowOrgId) && rowOrgId === expectedOrgId;
}

export function filterSameOrganization<T extends { organizationId: string }>(
  rows: readonly T[],
  organizationId: string,
): T[] {
  return rows.filter((row) => assertSameOrganization(row.organizationId, organizationId));
}

export function parseMentions(body: string, members: readonly { profileId: string; displayName: string }[]): string[] {
  const ids = new Set<string>();
  for (const member of members) {
    const needle = `@${member.displayName}`;
    if (member.displayName && body.includes(needle)) {
      ids.add(member.profileId);
    }
  }
  return [...ids];
}

export function chatClientRetryState(status: "sending" | "failed" | "sent"): "sending" | "failed" | "sent" {
  return status;
}

export type OnboardingFlags = {
  hasOrganization: boolean;
  hasProject: boolean;
  hasInviteOrMember: boolean;
  hasPhoto: boolean;
  hasTask: boolean;
};

export function onboardingComplete(flags: OnboardingFlags): boolean {
  return flags.hasOrganization && flags.hasProject && flags.hasInviteOrMember && flags.hasPhoto && flags.hasTask;
}

export function exportJobOrgSafe(jobOrganizationId: string, rowOrganizationId: string): boolean {
  return assertSameOrganization(jobOrganizationId, rowOrganizationId);
}

export function acceptOnlySessionOrganization(
  sessionOrganizationId: string,
  claimedOrganizationId: string | undefined,
): boolean {
  return !claimedOrganizationId || claimedOrganizationId === sessionOrganizationId;
}

/** Company A must not run or fetch Company B's export job. */
export function authorizeExportJobRun(input: {
  sessionOrganizationId: string;
  jobOrganizationId: string | null | undefined;
  claimedOrganizationId?: string;
}): boolean {
  if (!input.sessionOrganizationId || !input.jobOrganizationId) {
    return false;
  }
  if (input.jobOrganizationId !== input.sessionOrganizationId) {
    return false;
  }
  if (input.claimedOrganizationId && input.claimedOrganizationId !== input.sessionOrganizationId) {
    return false;
  }
  return true;
}
