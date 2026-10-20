/**
 * 「今月の KENBEI」：今月 KENBEI でやったことと、浮いた時間の目安。
 * 続けるか考えるときに、月額と比べられるようにする。前提は画面にも出す。
 */

/** 日報1枚あたりの短縮（事務所で Excel に書いて写真を貼る 約1時間 → 現場で 約15分） */
export const MINUTES_SAVED_PER_REPORT = 45;
/** 出面1人工あたりの短縮（紙の出面表からの転記・集計） */
export const MINUTES_SAVED_PER_WORKDAY = 3;
/** 監督の時間を円にするときの目安（時給） */
export const HOURLY_COST_YEN = 2500;

export type MonthActivity = { reports: number; photos: number; workdays: number };

export type MonthValue = MonthActivity & { minutesSaved: number; yenSaved: number };

export function estimateMonthValue(activity: MonthActivity): MonthValue {
  const minutesSaved = activity.reports * MINUTES_SAVED_PER_REPORT + activity.workdays * MINUTES_SAVED_PER_WORKDAY;
  // 100円単位に丸めて、細かすぎる数字にしない
  const yenSaved = Math.round((minutesSaved / 60) * HOURLY_COST_YEN / 100) * 100;
  return { ...activity, minutesSaved, yenSaved };
}

export function formatSavedTime(minutes: number): string {
  if (minutes < 60) return `約${minutes}分`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `約${Number.isInteger(hours) ? hours : hours.toFixed(1)}時間`;
}
