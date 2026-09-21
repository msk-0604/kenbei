import { billingPlanByCode, normalizeBillingPlanCode, type BillingAccessKind } from "@kensapo/domain";

export function seatRangeLabel(planCode: string): string {
  switch (normalizeBillingPlanCode(planCode)) {
    case "free":
      return "14日間無料体験";
    case "standard":
      return "会社ひとつ分";
    case "business":
      return "51名以上";
    default:
      return "51名以上";
  }
}

export function monthlyPriceLabel(planCode: string): string {
  const plan = billingPlanByCode(planCode);
  if (plan.code === "enterprise") {
    return "お問い合わせ";
  }
  if (plan.monthlyPriceJpy === 0) {
    return "月額 0円";
  }
  return `月額 ${plan.monthlyPriceJpy.toLocaleString("ja-JP")}円`;
}

export function currentPlanHeadline(planCode: string, access?: BillingAccessKind): string {
  if (access === "trial_active") {
    return "現在 14日間無料体験";
  }
  if (access === "trial_expired") {
    return "14日間の無料体験が終了しました";
  }
  if (access === "paid_inactive") {
    return "契約が無効です";
  }
  return `現在 ${billingPlanByCode(planCode).name}`;
}

export function isFreePlan(planCode: string): boolean {
  return normalizeBillingPlanCode(planCode) === "free";
}

export function planUseLine(planCode: string): string {
  switch (normalizeBillingPlanCode(planCode)) {
    case "free":
      return "カード登録なしで、KENBEIの流れを14日間試せます。";
    case "standard":
      return "現場事務を、会社の標準業務にするプランです。";
    case "business":
      return "より大きな施工チームで、同じ流れを会社の運用として続けるプランです。";
    default:
      return "人数に合わせてご相談ください。";
  }
}

export function standardScopeLine(): string {
  return "会社ひとつ分の月額";
}

export function standardFlatNote(): string {
  return "人数が変わっても、月額は39,800円です。";
}

export function trialPlanLabel(): string {
  return "14日間無料体験";
}
