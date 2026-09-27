export function parseTrialEmailAllowlist(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowlistedTrialEmail(email: string, allowlist: string[]): boolean {
  const normalized = email.trim().toLowerCase();
  return Boolean(normalized) && allowlist.includes(normalized);
}

/** Local preview/send only. Never used by production cron. */
export function canSendLocalTrialEmailTest(input: {
  production: boolean;
  testFlag: string;
  email: string;
  allowlistRaw: string;
}): boolean {
  if (input.production) {
    return false;
  }
  if (input.testFlag !== "1") {
    return false;
  }
  return isAllowlistedTrialEmail(input.email, parseTrialEmailAllowlist(input.allowlistRaw));
}
