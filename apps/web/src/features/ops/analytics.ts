/**
 * 運営の分析（PDCA 用）。会社ごとの記録から、立ち上がりの漏れ・週ごとの推移・機能の利用・契約率をまとめる。
 * DB からの読み出しは analytics-queries.ts。ここは計算だけ（テストできるように）。
 */

export type OrgFacts = {
  organizationId: string;
  name: string;
  createdAt: string;
  ownerEmail: string | null;
  source: string;
  paying: boolean;
  everPaid: boolean;
  hasSite: boolean;
  hasWorker: boolean;
  hasSchedule: boolean;
  hasWorkStart: boolean;
  hasConfirmedReport: boolean;
};

/** 日時の記録（どの会社が・いつ・何をしたか）。n はその日の件数（省略は1） */
export type ActivityEvent = {
  organizationId: string;
  at: string;
  kind: "schedule" | "work_start" | "photo" | "report" | "task" | "chat";
  n?: number;
};

export const FUNNEL_STEPS = [
  { key: "signup", label: "会社を登録", hint: "" },
  { key: "site", label: "現場を登録", hint: "登録した日に、現場を1件いっしょに入れる電話をする" },
  { key: "worker", label: "作業員を登録", hint: "作業員の登録と合言葉の決め方を案内する" },
  { key: "schedule", label: "予定を入れた", hint: "「明日の予定を入れてみましょう」とメールで案内する" },
  { key: "workStart", label: "作業員がスマホで作業開始", hint: "作業員への案内（LINE の文面・印刷の案内）を送ってもらう" },
  { key: "report", label: "日報を確定", hint: "日報の作り方（15分）を画面共有で見せる" },
  { key: "paid", label: "契約", hint: "お試し終了の前に、請求書払いも含めて案内する" },
] as const;

export type FunnelRow = { key: string; label: string; hint: string; count: number; rateFromPrev: number | null; rateFromTop: number };

export function funnel(orgs: readonly OrgFacts[]): FunnelRow[] {
  const flags: Record<string, (org: OrgFacts) => boolean> = {
    signup: () => true,
    site: (o) => o.hasSite,
    worker: (o) => o.hasSite && o.hasWorker,
    schedule: (o) => o.hasSite && o.hasWorker && o.hasSchedule,
    workStart: (o) => o.hasSite && o.hasWorker && o.hasSchedule && o.hasWorkStart,
    report: (o) => o.hasSite && o.hasWorker && o.hasSchedule && o.hasWorkStart && o.hasConfirmedReport,
    paid: (o) => o.everPaid || o.paying,
  };
  const top = orgs.length;
  let prev: number | null = null;
  return FUNNEL_STEPS.map((step) => {
    const count = orgs.filter((org) => flags[step.key]?.(org)).length;
    const row = {
      key: step.key,
      label: step.label,
      hint: step.hint,
      count,
      rateFromPrev: prev === null ? null : prev === 0 ? 0 : count / prev,
      rateFromTop: top === 0 ? 0 : count / top,
    };
    prev = count;
    return row;
  });
}

/** いちばん多く落ちている段（次に手を打つところ）。登録だけで止まっている会社がいなければ null */
export function biggestDrop(rows: readonly FunnelRow[]): FunnelRow | null {
  let worst: FunnelRow | null = null;
  let worstLoss = 0;
  for (let i = 1; i < rows.length; i++) {
    const loss = (rows[i - 1]?.count ?? 0) - (rows[i]?.count ?? 0);
    if (loss > worstLoss) {
      worstLoss = loss;
      worst = rows[i] ?? null;
    }
  }
  return worst;
}

/** 日本時間で、その日を含む週の月曜（YYYY-MM-DD） */
export function weekStartJst(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export type WeekRow = {
  week: string;
  /** トップページなどへの訪問（人） */
  visits: number;
  signups: number;
  activeOrgs: number;
  schedules: number;
  workStarts: number;
  photos: number;
  reports: number;
};

export function weeklyTrend(
  orgs: readonly OrgFacts[],
  events: readonly ActivityEvent[],
  now: Date,
  weeks = 8,
  visits: readonly { day: string; n: number }[] = [],
): WeekRow[] {
  const thisWeek = weekStartJst(now.toISOString());
  const keys: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(`${thisWeek}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i * 7);
    keys.push(d.toISOString().slice(0, 10));
  }
  const rows = new Map(
    keys.map((week) => [week, { week, visits: 0, signups: 0, activeOrgs: 0, schedules: 0, workStarts: 0, photos: 0, reports: 0 }]),
  );
  for (const visit of visits) {
    const row = rows.get(weekStartJst(`${visit.day}T12:00:00+09:00`));
    if (row) row.visits += visit.n;
  }
  const active = new Map(keys.map((week) => [week, new Set<string>()]));
  for (const org of orgs) {
    const row = rows.get(weekStartJst(org.createdAt));
    if (row) row.signups += 1;
  }
  for (const event of events) {
    const week = weekStartJst(event.at);
    const row = rows.get(week);
    if (!row) continue;
    const n = event.n ?? 1;
    active.get(week)?.add(event.organizationId);
    if (event.kind === "schedule") row.schedules += n;
    if (event.kind === "work_start") row.workStarts += n;
    if (event.kind === "photo") row.photos += n;
    if (event.kind === "report") row.reports += n;
  }
  return keys.map((week) => ({ ...(rows.get(week) as WeekRow), activeOrgs: active.get(week)?.size ?? 0 }));
}

export const FEATURE_LABELS: Record<ActivityEvent["kind"], string> = {
  schedule: "予定を入れる",
  work_start: "作業開始・終了（作業員）",
  photo: "写真",
  report: "日報",
  task: "タスク",
  chat: "チャット",
};

/** 直近 days 日に、その機能を使った会社の数と、使った回数 */
export function featureUsage(orgs: readonly OrgFacts[], events: readonly ActivityEvent[], now: Date, days = 30) {
  const since = now.getTime() - days * 86_400_000;
  const orgIds = new Set(orgs.map((org) => org.organizationId));
  return (Object.keys(FEATURE_LABELS) as ActivityEvent["kind"][]).map((kind) => {
    const recent = events.filter((e) => e.kind === kind && orgIds.has(e.organizationId) && new Date(e.at).getTime() >= since);
    const users = new Set(recent.map((e) => e.organizationId)).size;
    const count = recent.reduce((sum, e) => sum + (e.n ?? 1), 0);
    return { kind, label: FEATURE_LABELS[kind], orgs: users, rate: orgIds.size === 0 ? 0 : users / orgIds.size, count };
  });
}

export type ConversionRow = { key: string; signups: number; paid: number; rate: number };

function conversionBy(orgs: readonly OrgFacts[], keyOf: (org: OrgFacts) => string): ConversionRow[] {
  const map = new Map<string, ConversionRow>();
  for (const org of orgs) {
    const key = keyOf(org);
    const row = map.get(key) ?? { key, signups: 0, paid: 0, rate: 0 };
    row.signups += 1;
    if (org.everPaid || org.paying) row.paid += 1;
    map.set(key, row);
  }
  return [...map.values()].map((row) => ({ ...row, rate: row.signups === 0 ? 0 : row.paid / row.signups }));
}

/** 登録した月ごとの契約率（新しい月が上） */
export function conversionByMonth(orgs: readonly OrgFacts[]): ConversionRow[] {
  const jstMonth = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 7);
  return conversionBy(orgs, (org) => jstMonth(org.createdAt)).sort((a, b) => b.key.localeCompare(a.key));
}

/** 流入元ごとの契約率（登録の多い順） */
export function conversionBySource(orgs: readonly OrgFacts[]): ConversionRow[] {
  return conversionBy(orgs, (org) => org.source).sort((a, b) => b.signups - a.signups);
}

export function percent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/** 運営の会社（PLATFORM_ADMIN_EMAILS の人が代表）のテストは、数字に入れない */
export function excludeInternal<T extends { ownerEmail: string | null }>(rows: readonly T[], adminEmails: string | null | undefined): T[] {
  const admins = new Set(
    (adminEmails ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  return rows.filter((row) => !row.ownerEmail || !admins.has(row.ownerEmail.toLowerCase()));
}

/** 会社ごとの一覧を CSV に（スプレッドシートで分析する用） */
export function orgFactsCsv(orgs: readonly OrgFacts[]): string {
  const yes = (value: boolean) => (value ? "1" : "0");
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const head = ["会社", "登録日", "代表のメール", "流入元", "契約中", "契約したことがある", "現場", "作業員", "予定", "作業開始", "日報確定"];
  const lines = [head.join(",")];
  for (const org of orgs) {
    lines.push(
      [
        org.name,
        org.createdAt.slice(0, 10),
        org.ownerEmail ?? "",
        org.source,
        yes(org.paying),
        yes(org.everPaid),
        yes(org.hasSite),
        yes(org.hasWorker),
        yes(org.hasSchedule),
        yes(org.hasWorkStart),
        yes(org.hasConfirmedReport),
      ]
        .map(escape)
        .join(","),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
