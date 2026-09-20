import { normalizeBillingPlanCode } from "./billing";

export const BILLING_ACCESS_KINDS = [
  "grandfathered_free",
  "trial_active",
  "trial_expired",
  "paid_active",
  "paid_inactive",
] as const;

export type BillingAccessKind = (typeof BILLING_ACCESS_KINDS)[number];

export type BillingAccessInput = {
  planCode: string | null | undefined;
  status: string | null | undefined;
  trialEndsAt: string | null | undefined;
  now?: Date | string;
};

const PAID_ACTIVE_STATUSES = new Set(["active"]);

export const TRIAL_EXPIRED_WRITE_MESSAGE =
  "14日間の無料体験が終了しました。引き続きKENBEIをご利用いただくには、STANDARDまたはBUSINESSをご契約ください。";

export const PAID_INACTIVE_WRITE_MESSAGE =
  "ご契約が無効です。引き続きKENBEIをご利用いただくには、STANDARDまたはBUSINESSをご契約ください。";

function asDate(value: Date | string | undefined): Date {
  if (!value) {
    return new Date();
  }
  return value instanceof Date ? value : new Date(value);
}

export function classifyBillingAccess(input: BillingAccessInput): BillingAccessKind {
  const status = (input.status ?? "active").toLowerCase();
  const plan = normalizeBillingPlanCode(input.planCode);
  const now = asDate(input.now).getTime();
  const trialEndsAt = input.trialEndsAt ? new Date(input.trialEndsAt).getTime() : null;
  const paidPlan = plan === "standard" || plan === "business" || plan === "enterprise";

  if (status === "trialing") {
    if (trialEndsAt != null && trialEndsAt > now) {
      return "trial_active";
    }
    if (paidPlan && trialEndsAt == null) {
      return "paid_active";
    }
    return "trial_expired";
  }

  if (paidPlan && PAID_ACTIVE_STATUSES.has(status)) {
    return "paid_active";
  }

  if (plan === "free" && status === "active") {
    return "grandfathered_free";
  }

  return "paid_inactive";
}

export function workspaceWritesAllowed(access: BillingAccessKind): boolean {
  return access === "grandfathered_free" || access === "trial_active" || access === "paid_active";
}

export function workspaceWriteBlockMessage(access: BillingAccessKind): string | null {
  if (access === "trial_expired") {
    return TRIAL_EXPIRED_WRITE_MESSAGE;
  }
  if (access === "paid_inactive") {
    return PAID_INACTIVE_WRITE_MESSAGE;
  }
  return null;
}

export function canStartCheckout(canManageOrg: boolean): boolean {
  return canManageOrg;
}

export function canOpenBillingPortal(canManageOrg: boolean, stripeCustomerId: string | null | undefined): boolean {
  return canManageOrg && Boolean(stripeCustomerId);
}

export function trialDaysRemaining(trialEndsAt: string | null | undefined, now?: Date | string): number | null {
  if (!trialEndsAt) {
    return null;
  }
  const ms = new Date(trialEndsAt).getTime() - asDate(now).getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
