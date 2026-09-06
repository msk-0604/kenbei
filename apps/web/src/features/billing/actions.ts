"use server";

import { redirect } from "next/navigation";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { getAppUrl } from "@/lib/env";
import { persistableBillingPlanCode } from "@kensapo/domain";
import { stripePriceIdForPlan } from "@/lib/entitlement";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function stripeSecret(): string | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key && !key.includes("YOUR_") ? key : null;
}

export async function startCheckoutFormAction(formData: FormData): Promise<void> {
  const planCode = String(formData.get("planCode") ?? "");
  const result = await startCheckoutAction(planCode);
  if (result?.error) {
    redirect(`/settings/billing?error=${encodeURIComponent(result.error)}`);
  }
}

export async function startCheckoutAction(planCode: string): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "org.manage")) {
    return { error: "課金を変更する権限がありません。" };
  }
  const secret = stripeSecret();
  const checkoutPlan = persistableBillingPlanCode(planCode);
  if (checkoutPlan !== "pro" && checkoutPlan !== "business") {
    return { error: "このプランは画面から契約できません。51名以上は要相談です。" };
  }
  const price = stripePriceIdForPlan(planCode);
  if (!secret || !price) {
    return { error: "Stripe の Price ID が未設定です。" };
  }
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      mode: "subscription",
      success_url: `${getAppUrl()}/settings/billing?ok=1`,
      cancel_url: `${getAppUrl()}/settings/billing?canceled=1`,
      client_reference_id: workspace.organizationId,
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      "subscription_data[metadata][organization_id]": workspace.organizationId,
      "subscription_data[metadata][plan_code]": checkoutPlan,
      "metadata[organization_id]": workspace.organizationId,
      "metadata[plan_code]": checkoutPlan,
    }),
  });
  const json = (await res.json()) as { url?: string; error?: { message: string } };
  if (!json.url) {
    return { error: json.error?.message ?? "Checkout を開始できませんでした。" };
  }
  redirect(json.url);
}

export async function openBillingPortalAction(): Promise<void> {
  const result = await openBillingPortal();
  if (result?.error) {
    redirect(`/settings/billing?error=${encodeURIComponent(result.error)}`);
  }
}

async function openBillingPortal(): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "org.manage")) {
    return { error: "権限がありません。" };
  }
  const secret = stripeSecret();
  const admin = createAdminSupabaseClient();
  const supabase = admin ?? (await createServerSupabaseClient());
  const row = await supabase
    .from("organization_billing")
    .select("stripe_customer_id")
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  const customer = (row.data as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (!secret || !customer) {
    return { error: "ポータルを開けません。先にアップグレードしてください。" };
  }
  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      customer,
      return_url: `${getAppUrl()}/settings/billing`,
    }),
  });
  const json = (await res.json()) as { url?: string; error?: { message: string } };
  if (!json.url) {
    return { error: json.error?.message ?? "ポータルを開始できませんでした。" };
  }
  redirect(json.url);
}

export async function cancelSubscriptionAction(): Promise<void> {
  const result = await cancelSubscription();
  if (result?.error) {
    redirect(`/settings/billing?error=${encodeURIComponent(result.error)}`);
  }
}

async function cancelSubscription(): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "org.manage")) {
    return { error: "権限がありません。" };
  }
  const secret = stripeSecret();
  const admin = createAdminSupabaseClient();
  const supabase = admin ?? (await createServerSupabaseClient());
  const row = await supabase
    .from("organization_billing")
    .select("stripe_subscription_id")
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  const sub = (row.data as { stripe_subscription_id: string | null } | null)?.stripe_subscription_id;
  if (!secret || !sub) {
    return { error: "解約する契約がありません。" };
  }
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${sub}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ cancel_at_period_end: "true" }),
  });
  if (!res.ok) {
    return { error: "解約予約に失敗しました。" };
  }
  await supabase
    .from("organization_billing")
    .update({ cancel_at_period_end: true })
    .eq("organization_id", workspace.organizationId);
  return null;
}
