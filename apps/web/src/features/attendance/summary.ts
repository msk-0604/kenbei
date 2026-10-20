/**
 * 出面表（でづら）：作業員が押した「作業開始・終了」から、月ごとに誰が・どの現場で・何日・何時間いたかをまとめる。
 * 「作業開始」を押した日だけを出た日として数える。時間は開始から終了まで（休憩を含む）。
 */

export type WorkRecord = {
  date: string; // YYYY-MM-DD（日本時間の予定日）
  workerId: string;
  workerName: string;
  siteId: string;
  siteName: string;
  startedAt: string | null; // ISO
  endedAt: string | null; // ISO
};

export type AttendanceRow = WorkRecord & {
  /** 終了まで押してあれば分。押していなければ null */
  minutes: number | null;
};

export type WorkerAttendance = {
  workerId: string;
  workerName: string;
  /** 出た日数（同じ日に2現場でも1日） */
  days: number;
  /** 終了まで押した分の合計 */
  minutes: number;
  /** 開始だけで終了が押されていない回数 */
  openCount: number;
  sites: { siteId: string; siteName: string; days: number; minutes: number }[];
  rows: AttendanceRow[];
};

export function workMinutes(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || !endedAt) return null;
  const diff = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
}

export function summarizeAttendance(records: readonly WorkRecord[]): WorkerAttendance[] {
  const byWorker = new Map<string, WorkerAttendance & { dates: Set<string>; siteDates: Map<string, Set<string>> }>();
  for (const record of records) {
    if (!record.startedAt) continue;
    const minutes = workMinutes(record.startedAt, record.endedAt);
    let worker = byWorker.get(record.workerId);
    if (!worker) {
      worker = {
        workerId: record.workerId,
        workerName: record.workerName,
        days: 0,
        minutes: 0,
        openCount: 0,
        sites: [],
        rows: [],
        dates: new Set(),
        siteDates: new Map(),
      };
      byWorker.set(record.workerId, worker);
    }
    worker.rows.push({ ...record, minutes });
    worker.dates.add(record.date);
    if (minutes === null) worker.openCount += 1;
    else worker.minutes += minutes;

    let site = worker.sites.find((item) => item.siteId === record.siteId);
    if (!site) {
      site = { siteId: record.siteId, siteName: record.siteName, days: 0, minutes: 0 };
      worker.sites.push(site);
    }
    site.minutes += minutes ?? 0;
    const siteDates = worker.siteDates.get(record.siteId) ?? new Set<string>();
    siteDates.add(record.date);
    worker.siteDates.set(record.siteId, siteDates);
    site.days = siteDates.size;
  }
  return [...byWorker.values()]
    .map((worker): WorkerAttendance => ({
      workerId: worker.workerId,
      workerName: worker.workerName,
      days: worker.dates.size,
      minutes: worker.minutes,
      openCount: worker.openCount,
      sites: [...worker.sites].sort((a, b) => b.days - a.days || a.siteName.localeCompare(b.siteName, "ja")),
      rows: [...worker.rows].sort((a, b) => a.date.localeCompare(b.date) || (a.startedAt ?? "").localeCompare(b.startedAt ?? "")),
    }))
    .sort((a, b) => a.workerName.localeCompare(b.workerName, "ja"));
}

/** 何時間何分（例：8時間30分）。0 分は「0時間」 */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

/** Excel でそのまま開ける CSV（UTF-8・BOM 付き）。1行が1回の作業 */
export function attendanceCsv(workers: readonly WorkerAttendance[], clock: (iso: string | null) => string): string {
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [["日付", "作業員", "現場", "開始", "終了", "時間（時間）", "メモ"].join(",")];
  for (const worker of workers) {
    for (const row of worker.rows) {
      lines.push(
        [
          row.date,
          row.workerName,
          row.siteName,
          clock(row.startedAt),
          clock(row.endedAt),
          row.minutes === null ? "" : (row.minutes / 60).toFixed(2),
          row.minutes === null ? "終了が押されていません" : "",
        ]
          .map(escape)
          .join(","),
      );
    }
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** "2026-10" のような月。おかしな値なら今月 */
export function normalizeMonth(value: string | null | undefined, today: string): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : today.slice(0, 7);
}

export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}
