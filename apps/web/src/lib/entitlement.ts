import "server-only";

import { billingPlanByCode, persistableBillingPlanCode, seatLimitError } from "@kensapo/domain";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/session";

export type Entitlement = {
  planCode: string;
  planName: string;
  maxMembers: number | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
};

export async function getEntitlement(organizationId: string): Promise<Entitlement> {
  const supabase = await createServerSupabaseClient();
  const billing = await supabase
    .from("organization_billing")
    .select("plan_code, status, cancel_at_period_end, current_period_end, stripe_customer_id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const row = billing.data as {
    plan_code: string;
    status: string;
    cancel_at_period_end: boolean;
    current_period_end: string | null;
    stripe_customer_id: string | null;
  } | null;
  const catalog = billingPlanByCode(row?.plan_code);
  return {
    planCode: catalog.code,
    planName: catalog.name,
    maxMembers: catalog.maxMembers,
    status: row?.status ?? "active",
    cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
    currentPeriodEnd: row?.current_period_end ?? null,
    stripeCustomerId: row?.stripe_customer_id ?? null,
  };
}

export async function assertSeatAvailable(workspace: Workspace): Promise<{ error: string } | null> {
  const entitlement = await getEntitlement(workspace.organizationId);
  const supabase = await createServerSupabaseClient();
  const members = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", workspace.organizationId)
    .eq("status", "active")
    .is("deleted_at", null);
  const pending = await supabase
    .from("organization_invitations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", workspace.organizationId)
    .is("accepted_at", null)
    .is("deleted_at", null);
  const next = (members.count ?? 0) + (pending.count ?? 0) + 1;
  const blocked = seatLimitError(entitlement.planCode, next);
  if (blocked) {
    return { error: blocked };
  }
  return null;
}

export function stripePriceIdForPlan(planCode: string): string | null {
  const official = persistableBillingPlanCode(planCode);
  if (official === "pro" || planCode === "standard" || planCode === "team") {
    return (
      process.env.STRIPE_PRICE_STANDARD ||
      process.env.STRIPE_PRICE_PRO ||
      process.env.STRIPE_PRICE_TEAM ||
      null
    );
  }
  if (official === "business") {
    return process.env.STRIPE_PRICE_BUSINESS || null;
  }
  return null;
}
