import { classifyBillingAccess } from "@kensapo/domain";

/** platform_org_overview() の1行 */
export type OrgOverviewRow = {
  organization_id: string;
  name: string;
  created_at: string;
  plan_code: string | null;
  billing_status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  owner_email: string | null;
  member_count: number;
  worker_count: number;
  site_count: number;
  schedules_7d: number;
  schedules_30d: number;
  reports_30d: number;
  photos_30d: number;
  last_activity_at: string | null;
  last_sign_in_at: string | null;
};

export type OrgHealthKind = "unpaid" | "setup" | "trial_ending" | "inactive" | "canceling" | "healthy" | "lost";

export type OrgHealth = {
  kind: OrgHealthKind;
  label: string;
  /** 運営から連絡したほうがよいか */
  needsFollowUp: boolean;
  /** 次にやること（電話のときの話題） */
  action: string;
};

const DAY = 24 * 60 * 60 * 1000;

function daysSince(iso: string | null, now: number): number | null {
  if (!iso) {
    return null;
  }
  return Math.floor((now - new Date(iso).getTime()) / DAY);
}

/**
 * 会社ごとの「いま連絡すべきか」を決める。
 * 解約の多くは最初の1週間で使わなくなることから始まるので、未設定・休眠を早めに拾う。
 */
export function classifyOrgHealth(row: OrgOverviewRow, nowInput: Date = new Date()): OrgHealth {
  const now = nowInput.getTime();
  const access = classifyBillingAccess({
    planCode: row.plan_code,
    status: row.billing_status,
    trialEndsAt: row.trial_ends_at,
    now: nowInput,
  });
  const idleDays = daysSince(row.last_activity_at, now);
  const ageDays = daysSince(row.created_at, now) ?? 0;

  if (row.billing_status === "past_due" || row.billing_status === "unpaid") {
    return { kind: "unpaid", label: "未払い", needsFollowUp: true, action: "請求書・カードの支払いをお願いする" };
  }
  if (access === "trial_expired" || access === "paid_inactive") {
    return { kind: "lost", label: "停止中", needsFollowUp: false, action: "使わなかった理由を聞く" };
  }
  if (row.cancel_at_period_end) {
    return { kind: "canceling", label: "解約予約", needsFollowUp: true, action: "解約の理由を聞き、引き止められるか確かめる" };
  }
  if (row.site_count === 0 || (row.worker_count === 0 && row.member_count <= 1)) {
    return {
      kind: "setup",
      label: "初期設定まだ",
      needsFollowUp: ageDays >= 1,
      action: row.site_count === 0 ? "現場を1件いっしょに登録する" : "作業員の登録と合言葉の設定を手伝う",
    };
  }
  if (access === "trial_active" && row.trial_ends_at) {
    const left = Math.ceil((new Date(row.trial_ends_at).getTime() - now) / DAY);
    if (left <= 3) {
      return { kind: "trial_ending", label: `お試し残り${Math.max(left, 0)}日`, needsFollowUp: true, action: "契約（カード・請求書払い）を案内する" };
    }
  }
  if (idleDays == null || idleDays >= 7 || row.schedules_7d === 0) {
    return {
      kind: "inactive",
      label: idleDays == null ? "未利用" : `${idleDays}日 使われていない`,
      needsFollowUp: true,
      action: "使い方で困っていないか電話で聞く",
    };
  }
  return { kind: "healthy", label: "順調", needsFollowUp: false, action: "" };
}

export type OverviewSummary = {
  total: number;
  paying: number;
  trial: number;
  followUp: number;
  monthlyRevenueJpy: number;
};

export function summarizeOverview(rows: OrgOverviewRow[], monthlyPriceJpy: number, nowInput: Date = new Date()): OverviewSummary {
  let paying = 0;
  let trial = 0;
  let followUp = 0;
  for (const row of rows) {
    const access = classifyBillingAccess({
      planCode: row.plan_code,
      status: row.billing_status,
      trialEndsAt: row.trial_ends_at,
      now: nowInput,
    });
    if (access === "paid_active") {
      paying += 1;
    } else if (access === "trial_active") {
      trial += 1;
    }
    if (classifyOrgHealth(row, nowInput).needsFollowUp) {
      followUp += 1;
    }
  }
  return { total: rows.length, paying, trial, followUp, monthlyRevenueJpy: paying * monthlyPriceJpy };
}

/** PLATFORM_ADMIN_EMAILS（カンマ区切り）に入っている人だけが運営画面を開ける */
export function isPlatformAdminEmail(email: string | null | undefined, allowList: string | null | undefined): boolean {
  if (!email || !allowList) {
    return false;
  }
  const target = email.trim().toLowerCase();
  return allowList
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(target);
}
