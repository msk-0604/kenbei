export const TRIAL_EMAIL_KINDS = ["trial_started", "trial_day3", "trial_ending_soon"] as const;
export type TrialEmailKind = (typeof TRIAL_EMAIL_KINDS)[number];

const DAY_MS = 86_400_000;
export const TRIAL_LENGTH_DAYS = 14;
export const TRIAL_STARTED_WINDOW_DAYS = 2;
export const TRIAL_DAY3_AFTER_DAYS = 3;
export const TRIAL_DAY3_WINDOW_DAYS = 2;
export const TRIAL_ENDING_SOON_DAYS = 2;

/** Trials that began before this instant are excluded from automated mail. 2026-09-28 00:00 JST. */
export const TRIAL_EMAIL_COHORT_START = new Date("2026-09-27T15:00:00.000Z");

export function trialStartAt(trialEndsAt: Date): Date {
  return new Date(trialEndsAt.getTime() - TRIAL_LENGTH_DAYS * DAY_MS);
}

export function isEligibleTrialEmailCohort(trialEndsAt: Date): boolean {
  return trialStartAt(trialEndsAt).getTime() >= TRIAL_EMAIL_COHORT_START.getTime();
}

function inSendWindow(now: Date, windowStart: Date, windowEnd: Date): boolean {
  return now.getTime() >= windowStart.getTime() && now.getTime() < windowEnd.getTime();
}

export function dueTrialEmailKinds(input: {
  now: Date;
  trialEndsAt: Date | null;
  status: string;
  sentKinds: Iterable<string>;
}): TrialEmailKind[] {
  if (input.status !== "trialing" || !input.trialEndsAt) {
    return [];
  }
  if (!isEligibleTrialEmailCohort(input.trialEndsAt)) {
    return [];
  }
  const sent = new Set(input.sentKinds);
  const started = trialStartAt(input.trialEndsAt);
  const due: TrialEmailKind[] = [];
  if (
    !sent.has("trial_started") &&
    inSendWindow(input.now, started, new Date(started.getTime() + TRIAL_STARTED_WINDOW_DAYS * DAY_MS))
  ) {
    due.push("trial_started");
  }
  if (
    !sent.has("trial_day3") &&
    inSendWindow(
      input.now,
      new Date(started.getTime() + TRIAL_DAY3_AFTER_DAYS * DAY_MS),
      new Date(started.getTime() + (TRIAL_DAY3_AFTER_DAYS + TRIAL_DAY3_WINDOW_DAYS) * DAY_MS),
    )
  ) {
    due.push("trial_day3");
  }
  if (
    !sent.has("trial_ending_soon") &&
    inSendWindow(
      input.now,
      new Date(input.trialEndsAt.getTime() - TRIAL_ENDING_SOON_DAYS * DAY_MS),
      input.trialEndsAt,
    )
  ) {
    due.push("trial_ending_soon");
  }
  return due;
}
