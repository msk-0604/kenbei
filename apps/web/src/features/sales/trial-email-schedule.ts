export const TRIAL_EMAIL_KINDS = ["trial_started", "trial_day3", "trial_ending_soon"] as const;
export type TrialEmailKind = (typeof TRIAL_EMAIL_KINDS)[number];

const DAY_MS = 86_400_000;
export const TRIAL_LENGTH_DAYS = 14;
export const TRIAL_STARTED_WINDOW_DAYS = 2;
export const TRIAL_DAY3_AFTER_DAYS = 3;
export const TRIAL_DAY3_WINDOW_DAYS = 2;
export const TRIAL_ENDING_SOON_DAYS = 2;

export function trialStartAt(trialEndsAt: Date): Date {
  return new Date(trialEndsAt.getTime() - TRIAL_LENGTH_DAYS * DAY_MS);
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
