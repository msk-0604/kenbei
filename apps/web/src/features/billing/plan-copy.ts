import { billingPlanByCode, normalizeBillingPlanCode } from "@kensapo/domain";

export function seatRangeLabel(planCode: string): string {
  switch (normalizeBillingPlanCode(planCode)) {
    case "free":
      return "1〜3名";
    case "standard":
      return "4〜30名まで";
    case "business":
      return "31〜50名";
    default:
      return "51名以上";
  }
}

export function monthlyPriceLabel(planCode: string): string {
  const plan = billingPlanByCode(planCode);
  if (plan.code === "enterprise" || plan.maxMembers == null) {
    return "お問い合わせ";
  }
  if (plan.monthlyPriceJpy === 0) {
    return "月額 0円";
  }
  return `月額 ${plan.monthlyPriceJpy.toLocaleString("ja-JP")}円`;
}

export function currentPlanHeadline(planCode: string): string {
  return `現在 ${billingPlanByCode(planCode).name}`;
}

export function isFreePlan(planCode: string): boolean {
  return normalizeBillingPlanCode(planCode) === "free";
}

export function planUseLine(planCode: string): string {
  switch (normalizeBillingPlanCode(planCode)) {
    case "free":
      return "少人数で、KENBEIの流れをそのまま試せます。";
    case "standard":
      return "現場事務を、会社の標準業務にするプランです。";
    case "business":
      return "より大きな施工チームで、同じ流れを会社の運用として続けるプランです。";
    default:
      return "51名以上は人数に合わせてご相談ください。";
  }
}

export function standardScopeLine(): string {
  return "会社ひとつ分の月額";
}

export function standardFlatNote(): string {
  return "10名でも20名でも、30名まで月額は39,800円です。";
}
