import {
  KENBEI_MAX_MEMBERS,
  KENBEI_MONTHLY_PRICE_JPY,
  KENBEI_PLAN_NAME,
  billingPlanByCode,
  normalizeBillingPlanCode,
  type BillingAccessKind,
} from "@kensapo/domain";

export function yen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

export function monthlyPriceLabel(planCode: string): string {
  const plan = billingPlanByCode(planCode);
  if (plan.code === "enterprise") {
    return "お問い合わせ";
  }
  if (plan.monthlyPriceJpy === 0) {
    return "月額 0円";
  }
  return `月額 ${yen(plan.monthlyPriceJpy)}`;
}

/** The one paid plan, as shown on the billing screen and landing page. */
export const KENBEI_PRICE_LABEL = `月額 ${yen(KENBEI_MONTHLY_PRICE_JPY)}`;

export const KENBEI_PRICE_NOTE = `税込・会社ごと・${KENBEI_MAX_MEMBERS}名まで同じ料金`;

/** 30日で割った1日あたりの目安（切り上げ）。 */
export function dailyPriceLabel(): string {
  return `1日あたり約${yen(Math.ceil(KENBEI_MONTHLY_PRICE_JPY / 30))}`;
}

export const KENBEI_INCLUDED = [
  "現場・写真・タスク・日報が全部使える",
  "日報はA4・PDFでそのまま提出",
  `メンバー${KENBEI_MAX_MEMBERS}名まで追加料金なし`,
  "スマホのブラウザからすぐ使える",
  "いつでも期末で解約できる",
] as const;

export function currentPlanHeadline(planCode: string, access?: BillingAccessKind): string {
  if (access === "trial_active") {
    return "いまは14日間の無料体験中です";
  }
  if (access === "trial_expired") {
    return "14日間の無料体験が終了しました";
  }
  if (access === "paid_active") {
    return `${KENBEI_PLAN_NAME}をご契約中です`;
  }
  if (access === "paid_inactive") {
    return "契約が無効です";
  }
  return `現在 ${billingPlanByCode(planCode).name}`;
}

export function isFreePlan(planCode: string): boolean {
  return normalizeBillingPlanCode(planCode) === "free";
}

export function trialPlanLabel(): string {
  return "14日間無料体験";
}

export function checkoutButtonLabel(access: BillingAccessKind): string {
  return access === "trial_active" ? "体験後も続ける（月額9,800円）" : "月額9,800円で契約する";
}
