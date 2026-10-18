"use server";

import { redirect } from "next/navigation";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { getAppUrl } from "@/lib/env";
import { classifyBillingAccess, persistableBillingPlanCode } from "@kensapo/domain";
import {
  buildInvoiceCustomerParams,
  buildInvoiceSubscriptionParams,
  invoicePendingBilling,
  isBankTransferUnavailable,
  validateInvoiceBillingInput,
} from "@/features/billing/invoice-billing";
import { summarizeStripeCheckoutFailure } from "@/features/billing/stripe-error";
import { subscriptionPeriodEndIso } from "@/features/billing/stripe-webhook";
import { resolveStripePriceForPlan } from "@/lib/entitlement";
import { consumeRateLimit, RATE_LIMIT_UNAVAILABLE_MESSAGE } from "@/lib/rate-limit";
import { readServerEnv } from "@/lib/server-env";
import { logServerError } from "@/lib/server-log";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { readAttributionFromCookies, stripeAttributionMetadata } from "@/features/sales/attribution-cookies";

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

type BillingPreflight =
  | { error: string }
  | { workspace: Awaited<ReturnType<typeof requireWorkspace>>; secret: string; price: string; checkoutPlan: string };

/** 契約を始める前の共通チェック（権限・回数制限・Stripe の設定） */
async function billingPreflight(planCode: string): Promise<BillingPreflight> {
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
  if (checkoutPlan !== "pro") {
    return { error: "このプランは画面から契約できません。21名以上はお問い合わせください。" };
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
  return { workspace, secret, price: priceLookup.price, checkoutPlan };
}

export async function startCheckoutAction(planCode: string): Promise<{ error: string } | null> {
  const preflight = await billingPreflight(planCode);
  if ("error" in preflight) {
    return preflight;
  }
  const { workspace, secret, price, checkoutPlan } = preflight;
  const attribution = stripeAttributionMetadata(readAttributionFromCookies(await cookies()));
  const checkoutParams = new URLSearchParams({
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
  });
  for (const [key, value] of Object.entries(attribution)) {
    checkoutParams.set(`metadata[${key}]`, value);
    checkoutParams.set(`subscription_data[metadata][${key}]`, value);
  }
  let res: Response;
  try {
    res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: checkoutParams,
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

export async function startInvoiceBillingFormAction(formData: FormData): Promise<void> {
  const result = await startInvoiceBilling(formData);
  if (result?.error) {
    redirect(`/settings/billing?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/settings/billing?invoice=1");
}

type StripeJson = { id?: string; status?: string; error?: { message?: string; param?: string } };

async function stripePost(secret: string, path: string, body: URLSearchParams): Promise<{ status: number; json: StripeJson }> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  return { status: res.status, json: (await res.json()) as StripeJson };
}

/** 請求書払い：毎月の請求書が届き、振込かカードで払う契約を作る */
async function startInvoiceBilling(formData: FormData): Promise<{ error: string } | null> {
  const input = validateInvoiceBillingInput({
    billingName: formData.get("billingName"),
    billingEmail: formData.get("billingEmail"),
  });
  if (!input.ok) {
    return { error: input.error };
  }
  const preflight = await billingPreflight("standard");
  if ("error" in preflight) {
    return preflight;
  }
  const { workspace, secret, price, checkoutPlan } = preflight;
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return { error: "原因: Vercel の SUPABASE_SERVICE_ROLE_KEY が空です。" };
  }
  const context = { organizationId: workspace.organizationId, userId: workspace.userId };
  const current = await admin
    .from("organization_billing")
    .select("stripe_customer_id, stripe_subscription_id, status, plan_code, trial_ends_at")
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  const row = current.data as {
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    status: string;
    plan_code: string;
    trial_ends_at: string | null;
  } | null;
  if (row?.stripe_subscription_id && row.status !== "canceled") {
    const active =
      classifyBillingAccess({ planCode: row.plan_code, status: row.status, trialEndsAt: row.trial_ends_at }) === "paid_active";
    return {
      error: active
        ? "すでに契約中です。支払い方法の変更は「支払い方法・領収書を確認」から行えます。"
        : "お支払いが済んでいない請求があります。「支払い方法・領収書を確認」からお支払いください。",
    };
  }

  try {
    let customer = row?.stripe_customer_id ?? null;
    const customerParams = buildInvoiceCustomerParams({ ...input.value, organizationId: workspace.organizationId });
    const customerResult = await stripePost(secret, customer ? `customers/${customer}` : "customers", customerParams);
    if (!customerResult.json.id) {
      await logServerError("stripe.invoice.customer_failed", { status: customerResult.status, message: customerResult.json.error?.message ?? "" }, context);
      return { error: customerResult.json.error?.message ?? "請求先を登録できませんでした。" };
    }
    customer = customerResult.json.id;

    const attribution = stripeAttributionMetadata(readAttributionFromCookies(await cookies()));
    const subscriptionParams = (bankTransfer: boolean) =>
      buildInvoiceSubscriptionParams({
        customer: customer as string,
        price,
        organizationId: workspace.organizationId,
        planCode: checkoutPlan,
        bankTransfer,
        attribution,
      });
    let subscription = await stripePost(secret, "subscriptions", subscriptionParams(true));
    if (!subscription.json.id && isBankTransferUnavailable(subscription.json.error)) {
      await logServerError("stripe.invoice.bank_transfer_unavailable", { message: subscription.json.error?.message ?? "" }, context);
      subscription = await stripePost(secret, "subscriptions", subscriptionParams(false));
    }
    if (!subscription.json.id) {
      const summary = summarizeStripeCheckoutFailure(subscription.status, subscription.json);
      await logServerError(
        "stripe.invoice.subscription_failed",
        { status: summary.status, stripe_type: summary.type, stripe_code: summary.code, stripe_message: summary.message },
        context,
      );
      return { error: summary.message };
    }

    // 入金を確認するまでは有料にしない（invoice.paid の Webhook で有料に切り替える）。お試し中ならお試しはそのまま。
    const pending = invoicePendingBilling(row);
    await admin.from("organization_billing").upsert({
      organization_id: workspace.organizationId,
      plan_code: checkoutPlan,
      status: pending.status,
      stripe_customer_id: customer,
      stripe_subscription_id: subscription.json.id,
      trial_ends_at: pending.trial_ends_at,
      cancel_at_period_end: false,
      current_period_end: subscriptionPeriodEndIso(subscription.json as Record<string, unknown>),
    });
  } catch {
    await logServerError("stripe.invoice.subscription_failed", { reason: "network" }, context);
    return { error: "請求書払いの手続きを開始できませんでした。時間をおいてやり直してください。" };
  }
  return null;
}
