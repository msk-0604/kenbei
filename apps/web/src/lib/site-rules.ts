/** 画面とテストで共有する、現場・予定・作業工程の業務ルール（kenbei-alpha と同じ判定）。 */

import { dateRangeISO } from "@/lib/site-dates";

// ---- 現場の状態 ------------------------------------------------------------

export type SiteStatus = "draft" | "active" | "on_hold" | "completed" | "cancelled";

export const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  draft: "仮予定",
  active: "進行中",
  on_hold: "一時停止",
  completed: "完了",
  cancelled: "中止",
};

/** 現場フォームで選べる状態（kenbei-alpha と同じ3つ） */
export const SITE_FORM_STATUSES = ["draft", "active", "completed"] as const satisfies readonly SiteStatus[];

export function isSiteStatus(value: unknown): value is SiteStatus {
  return typeof value === "string" && value in SITE_STATUS_LABELS;
}

export function siteStatusLabel(status: string): string {
  return isSiteStatus(status) ? SITE_STATUS_LABELS[status] : status;
}

export type WorkDuration = "long_term" | "one_off";

export function isWorkDuration(value: unknown): value is WorkDuration {
  return value === "long_term" || value === "one_off";
}

/** 完了以外 → 完了 の瞬間だけ完了のお知らせを出す */
export function becameCompleted(previous: string | null | undefined, next: string): boolean {
  return previous !== "completed" && next === "completed";
}

/**
 * completed_at のルール（DB のトリガーと同じ）
 * 完了以外 → 完了：今の時刻 / 完了 → 完了以外：消す / それ以外：変えない
 */
export function completedAtPatch(
  previous: string,
  next: string,
  now: Date = new Date(),
): { completed_at?: string | null } {
  if (previous !== "completed" && next === "completed") {
    return { completed_at: now.toISOString() };
  }
  if (previous === "completed" && next !== "completed") {
    return { completed_at: null };
  }
  return {};
}

/** 単発の現場は、着工日〜完了予定日の予定を1日1行で自動で作る（最大60日） */
export const ONE_OFF_SCHEDULE_MAX_DAYS = 60;

export function oneOffScheduleDates(
  workDuration: string | null | undefined,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string[] {
  if (workDuration !== "one_off" || !startDate) {
    return [];
  }
  return dateRangeISO(startDate, endDate || startDate, ONE_OFF_SCHEDULE_MAX_DAYS);
}

// ---- 作業工程 --------------------------------------------------------------

export type ProgressMark = "none" | "ok" | "attention";
export type ProgressChoice = "none" | "incomplete" | "complete";

export function normalizeMark(value: unknown, checked?: boolean): ProgressMark {
  if (value === "ok" || value === "attention" || value === "none") {
    return value;
  }
  return checked ? "ok" : "none";
}

export function choiceFromMark(mark: string | null | undefined, checked?: boolean): ProgressChoice {
  if (mark === "ok" || mark === "complete") {
    return "complete";
  }
  if (mark === "attention" || mark === "incomplete") {
    return "incomplete";
  }
  return checked ? "complete" : "none";
}

/** 同じボタンをもう一度押しても未確認には戻さない。別の状態へだけ進む。 */
export function nextProgressChoice(
  current: ProgressChoice,
  pressed: Exclude<ProgressChoice, "none">,
): ProgressChoice | null {
  return current === pressed ? null : pressed;
}

export function progressChoiceLabel(choice: ProgressChoice): string {
  if (choice === "complete") {
    return "完了";
  }
  if (choice === "incomplete") {
    return "未完了";
  }
  return "未確認";
}

export function isProgressConflict(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("conflict") || m.includes("他の人") || m.includes("version");
}

export type ProgressSummary = {
  total: number;
  completed: number;
  attention: number;
  pending: number;
  percent: number;
};

/** 進捗％ = 〇の件数 / 全件数（四捨五入） */
export function calcProgressSummary(items: readonly { mark: string | null }[]): ProgressSummary {
  const total = items.length;
  const completed = items.filter((item) => item.mark === "ok").length;
  const attention = items.filter((item) => item.mark === "attention").length;
  return {
    total,
    completed,
    attention,
    pending: total - completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export function progressItemLabel(item: { section: string | null; item_name: string }): string {
  return item.section && item.item_name ? `${item.section} ${item.item_name}` : item.item_name;
}

// ---- 予定 -----------------------------------------------------------------

export type ScheduleStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  scheduled: "予定",
  in_progress: "作業中",
  completed: "完了",
  cancelled: "取消",
};

export function scheduleStatusLabel(status: string): string {
  return (SCHEDULE_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

export function scheduleSortKey(timeKind: string | null | undefined, start: string | null | undefined): string {
  const kind = timeKind || (start ? "timed" : "unset");
  if (kind === "unset") {
    return "9-unset";
  }
  if (kind === "am") {
    return "1-am";
  }
  if (kind === "pm") {
    return "5-pm";
  }
  const hhmm = (start || "00:00").slice(0, 5);
  const hour = Number(hhmm.slice(0, 2));
  if (Number.isNaN(hour)) {
    return "9-unset";
  }
  return hour < 12 ? `2-${hhmm}` : `6-${hhmm}`;
}

export function formatScheduleTime(
  timeKind: string | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const kind = timeKind || (start || end ? "timed" : "unset");
  if (kind === "am") {
    return "午前";
  }
  if (kind === "pm") {
    return "午後";
  }
  if (kind === "unset" || (!start && !end)) {
    return "時間未定";
  }
  const a = (start || "").slice(0, 5);
  const b = (end || "").slice(0, 5);
  if (a && b) {
    return `${a}〜${b}`;
  }
  return a ? `${a}〜` : `〜${b}`;
}

// ---- お知らせの重複防止キー ----------------------------------------------

export function siteNoticeDedupeKey(projectId: string): string {
  return `site-published:${projectId}`;
}

export function siteCompletedDedupeKey(projectId: string, completedAt: string): string {
  return `site-completed:${projectId}:${completedAt.slice(0, 19)}`;
}

export function scheduleNoticeDedupeKey(groupOrId: string, revision: string): string {
  return `schedule:${groupOrId}:${revision.slice(0, 40)}`;
}

export function processNoticeDedupeKey(projectId: string, actionKey: string): string {
  return `process:${projectId}:${actionKey}`.slice(0, 120);
}
