/**
 * お試し中に契約したとき、Stripe の請求をお試しの終わりから始めるための trial_end（UNIX 秒）。
 * Stripe Checkout の trial_end は「今から48時間以上先」でないと受け付けないので、余裕を見て49時間とする。
 * お試しが終わっている・残りが短いときは null（申し込んだ日から請求）。
 */
export const MIN_TRIAL_CARRYOVER_MS = 49 * 60 * 60 * 1000;

export function trialCarryoverEnd(
  row: { status?: string | null; trial_ends_at?: string | null } | null,
  now: Date = new Date(),
): number | null {
  if (row?.status !== "trialing" || !row.trial_ends_at) {
    return null;
  }
  const ends = new Date(row.trial_ends_at).getTime();
  if (!Number.isFinite(ends) || ends - now.getTime() < MIN_TRIAL_CARRYOVER_MS) {
    return null;
  }
  return Math.floor(ends / 1000);
}
