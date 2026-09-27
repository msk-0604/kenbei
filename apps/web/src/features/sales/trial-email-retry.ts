export const TRIAL_EMAIL_MAX_ATTEMPTS = 5;

export function nextTrialEmailRetryAt(attemptCount: number, now: Date): Date {
  const exp = Math.max(0, attemptCount - 1);
  const minutes = Math.min(15 * 2 ** exp, 24 * 60);
  return new Date(now.getTime() + minutes * 60_000);
}

export function canRetryTrialEmail(input: {
  status: string;
  attemptCount: number;
  nextRetryAt: Date | string | null;
  now: Date;
}): boolean {
  if (input.status === "sent") {
    return false;
  }
  if (input.attemptCount >= TRIAL_EMAIL_MAX_ATTEMPTS) {
    return false;
  }
  if (!input.nextRetryAt) {
    return true;
  }
  return new Date(input.nextRetryAt).getTime() <= input.now.getTime();
}
