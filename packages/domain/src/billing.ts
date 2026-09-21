/**
 * Official KENBEI plans. Seat checks and UI must use this catalog.
 * Stripe Price IDs stay in env. DB `billing_plans` may still use legacy codes
 * (team/pro); persistableBillingPlanCode maps STANDARD → `pro` for the FK.
 */
export const BILLING_PLAN_CODES = ["free", "standard", "business", "enterprise"] as const;
export type BillingPlanCode = (typeof BILLING_PLAN_CODES)[number];

export type BillingPlanDefinition = {
  code: BillingPlanCode;
  name: string;
  maxMembers: number | null;
  monthlyPriceJpy: number;
};

export const DEFAULT_BILLING_PLANS: readonly BillingPlanDefinition[] = [
  { code: "free", name: "FREE", maxMembers: 50, monthlyPriceJpy: 0 },
  { code: "standard", name: "STANDARD", maxMembers: 50, monthlyPriceJpy: 39_800 },
  { code: "business", name: "BUSINESS", maxMembers: null, monthlyPriceJpy: 65_000 },
  { code: "enterprise", name: "ENTERPRISE", maxMembers: null, monthlyPriceJpy: 0 },
] as const;

export const BUSINESS_SEAT_CONSULT_MESSAGE = "51名以上は BUSINESS です。お問い合わせください。";

export function isBillingPlanCode(value: string): value is BillingPlanCode {
  return (BILLING_PLAN_CODES as readonly string[]).includes(value);
}

export function normalizeBillingPlanCode(code: string | null | undefined): BillingPlanCode {
  const value = (code ?? "free").toLowerCase();
  if (value === "standard" || value === "team" || value === "pro") {
    return "standard";
  }
  if (value === "business") {
    return "business";
  }
  if (value === "enterprise") {
    return "enterprise";
  }
  return "free";
}

/** Values that exist on Production `billing_plans.code` (no new migration). */
export function persistableBillingPlanCode(code: string | null | undefined): string {
  const normalized = normalizeBillingPlanCode(code);
  if (normalized === "standard") {
    return "pro";
  }
  return normalized;
}

export function billingPlanByCode(code: string | null | undefined): BillingPlanDefinition {
  const normalized = normalizeBillingPlanCode(code);
  const found = DEFAULT_BILLING_PLANS.find((plan) => plan.code === normalized);
  if (found) {
    return found;
  }
  return { code: "free", name: "FREE", maxMembers: 50, monthlyPriceJpy: 0 };
}

export function planAllowsMemberCount(
  plan: Pick<BillingPlanDefinition, "maxMembers">,
  memberCount: number,
): boolean {
  if (plan.maxMembers == null) {
    return true;
  }
  return memberCount <= plan.maxMembers;
}

export function seatLimitError(planCode: string | null | undefined, nextMemberCount: number): string | null {
  const plan = billingPlanByCode(planCode);
  if (plan.code === "business" || plan.code === "enterprise") {
    return null;
  }
  if (nextMemberCount >= 51) {
    return BUSINESS_SEAT_CONSULT_MESSAGE;
  }
  return null;
}
