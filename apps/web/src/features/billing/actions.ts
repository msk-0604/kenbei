"use server";

import { redirect } from "next/navigation";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { getAppUrl } from "@/lib/env";
import { persistableBillingPlanCode } from "@kensapo/domain";
import { summarizeStripeCheckoutFailure } from "@/features/billing/stripe-error";
import { resolveStripePriceForPlan } from "@/lib/entitlement";
import { consumeRateLimit, RATE_LIMIT_UNAVAILABLE_MESSAGE } from "@/lib/rate-limit";
import { readServerEnv } from "@/lib/server-env";
import { logServerError } from "@/lib/server-log";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function stripeSecret(): string | null {
  const key = readServerEnv("STRIPE_SECRET_KEY");
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
  const limit = await consumeRateLimit(`billing:${workspace.userId}`, 10, 60_000);
  if (!limit.allowed) {
    return {
      error: limit.reason === "unavailable" ? RATE_LIMIT_UNAVAILABLE_MESSAGE : "課金操作が多すぎます。少し待ってからやり直してください。",
    };
  }
  const secret = stripeSecret();
  const checkoutPlan = persistableBillingPlanCode(planCode);
  if (checkoutPlan !== "pro" && checkoutPlan !== "business") {
    return { error: "このプランは画面から契約できません。51名以上は要相談です。" };
  }
  const priceLookup = resolveStripePriceForPlan(planCode);
  if (!secret) {
    await logServerError(
      "stripe.checkout.env_missing",
      { missing: "STRIPE_SECRET_KEY", plan: checkoutPlan },
      { organizationId: workspace.organizationId, userId: workspace.userId },
    );
    return { error: "原因: Vercel の STRIPE_SECRET_KEY が空です。" };
  }
  if (!priceLookup.price) {
    await logServerError(
      "stripe.checkout.env_missing",
      { missing: priceLookup.emptyKeys.join(","), plan: checkoutPlan },
      { organizationId: workspace.organizationId, userId: workspace.userId },
    );
    return {
      error: `原因: Vercel の ${priceLookup.emptyKeys.join(" / ")} が空です。`,
    };
  }
  const price = priceLookup.price;
  let res: Response;
  try {
    res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
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
  } catch {
    await logServerError(
      "stripe.checkout.session_failed",
      { reason: "network", plan: checkoutPlan },
      { organizationId: workspace.organizationId, userId: workspace.userId },
    );
    return { error: "Checkout を開始できませんでした。" };
  }
  const json = (await res.json()) as { url?: string; error?: { message: string } };
  if (!json.url) {
    const summary = summarizeStripeCheckoutFailure(res.status, json);
    await logServerError(
      "stripe.checkout.session_failed",
      {
        reason: "stripe_api",
        plan: checkoutPlan,
        status: summary.status,
        stripe_type: summary.type,
        stripe_code: summary.code,
        stripe_message: summary.message,
      },
      { organizationId: workspace.organizationId, userId: workspace.userId },
    );
    return { error: summary.message };
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
  const limit = await consumeRateLimit(`billing:${workspace.userId}`, 10, 60_000);
  if (!limit.allowed) {
    return {
      error: limit.reason === "unavailable" ? RATE_LIMIT_UNAVAILABLE_MESSAGE : "課金操作が多すぎます。少し待ってからやり直してください。",
    };
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
  const limit = await consumeRateLimit(`billing:${workspace.userId}`, 10, 60_000);
  if (!limit.allowed) {
    return {
      error: limit.reason === "unavailable" ? RATE_LIMIT_UNAVAILABLE_MESSAGE : "課金操作が多すぎます。少し待ってからやり直してください。",
    };
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
