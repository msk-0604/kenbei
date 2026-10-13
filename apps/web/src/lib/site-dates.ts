import { tokyoTodayIso } from "@/lib/dates";

/** 予定・カレンダー用の日付ヘルパー。日付は日本時間の "YYYY-MM-DD" 文字列で扱う。 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIso(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: string | null | undefined): value is string {
  return typeof value === "string" && ISO_DATE.test(value) && !Number.isNaN(parseIso(value).getTime());
}

export function todayISO(): string {
  return tokyoTodayIso();
}

export function clampDateISO(date: string | null | undefined): string {
  return isIsoDate(date) ? date : todayISO();
}

export function addDaysISO(date: string, days: number): string {
  const d = parseIso(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function addMonthsISO(date: string, months: number): string {
  const d = parseIso(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return toIso(d);
}

export function sameMonthISO(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** 0 = 日曜 */
export function weekdayIndex(date: string): number {
  return parseIso(date).getUTCDay();
}

function monthMatrix(anchorDate: string, weekStartsOn: 0 | 1): string[] {
  const d = parseIso(anchorDate);
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12));
  const lead = (first.getUTCDay() - weekStartsOn + 7) % 7;
  const trail = (weekStartsOn + 6 - last.getUTCDay() + 7) % 7;
  const start = addDaysISO(toIso(first), -lead);
  const end = addDaysISO(toIso(last), trail);
  const dates: string[] = [];
  for (let cur = start; cur <= end; cur = addDaysISO(cur, 1)) {
    dates.push(cur);
  }
  return dates;
}

/** 月曜始まりの月カレンダー（前後の月の端数を含む） */
export function getMonthMatrixISO(anchorDate: string): string[] {
  return monthMatrix(anchorDate, 1);
}

/** 日曜始まりの月カレンダー（前後の月の端数を含む） */
export function getMonthMatrixSundayISO(anchorDate: string): string[] {
  return monthMatrix(anchorDate, 0);
}

/** start〜end の日付（end を含む）。上限 maxDays 件。 */
export function dateRangeISO(start: string, end: string, maxDays: number): string[] {
  if (!isIsoDate(start) || !isIsoDate(end) || end < start) {
    return isIsoDate(start) && maxDays > 0 ? [start] : [];
  }
  const dates: string[] = [];
  for (let cur = start; cur <= end && dates.length < maxDays; cur = addDaysISO(cur, 1)) {
    dates.push(cur);
  }
  return dates;
}

const JA_DATE = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const JA_DATE_WEEKDAY = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

function sourceDate(date: string): Date {
  const iso = date.slice(0, 10);
  return ISO_DATE.test(iso) && date.length <= 10 ? new Date(`${iso}T12:00:00+09:00`) : new Date(date);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) {
    return "-";
  }
  const d = sourceDate(date);
  return Number.isNaN(d.getTime()) ? "-" : JA_DATE.format(d);
}

export function formatDateWithWeekday(date: string): string {
  return JA_DATE_WEEKDAY.format(new Date(`${date}T12:00:00+09:00`));
}

export function formatYearMonth(date: string): string {
  const [y, m] = date.split("-");
  return `${Number(y)}年${Number(m)}月`;
}

export function formatShortDate(iso: string): string {
  const tokyo = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  const [y, m, d] = tokyo.split("-");
  return `${y}/${Number(m)}/${Number(d)}`;
}

export function formatTime(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : "";
}

export function formatClockTime(iso: string | null | undefined): string {
  if (!iso) {
    return "";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatMarkedAt(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** 日本時間のその日 0:00〜23:59:59.999 を ISO で返す（完了日の絞り込み用） */
export function tokyoDayBounds(date: string): { start: string; end: string } {
  return {
    start: `${date}T00:00:00+09:00`,
    end: `${date}T23:59:59.999+09:00`,
  };
}
