import { normalizeBillingPlanCode, persistableBillingPlanCode } from "@kensapo/domain";

export type StripeWebhookObject = Record<string, unknown>;

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: { object: StripeWebhookObject };
};

export type StripeEventClaim = "claimed" | "duplicate" | "error";

type BillingAdmin = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => {
      select: (columns: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
      };
    };
    upsert: (row: Record<string, unknown>) => PromiseLike<unknown>;
    update: (row: Record<string, unknown>) => { eq: (column: string, value: string) => PromiseLike<unknown> };
    select: (columns: string) => {
      eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: BillingRowSnapshot | null }> };
    };
  };
};

/** 契約の状態を決めるのに読む、organization_billing の今の値 */
type BillingRowSnapshot = { organization_id: string; status?: string | null; trial_ends_at?: string | null };

/**
 * 次回更新日（UNIX 秒）。
 * 2025-03-31 より前の Stripe API は subscription.current_period_end、それ以降は items.data[].current_period_end にある。
 * どちらの API バージョンの Webhook・レスポンスでも読めるようにする。
 */
export function subscriptionPeriodEnd(obj: StripeWebhookObject): number | null {
  const top = Number(obj.current_period_end);
  if (Number.isFinite(top) && top > 0) {
    return top;
  }
  const items = (obj.items as { data?: { current_period_end?: unknown }[] } | undefined)?.data ?? [];
  const ends = items.map((item) => Number(item.current_period_end)).filter((value) => Number.isFinite(value) && value > 0);
  return ends.length > 0 ? Math.max(...ends) : null;
}

export function subscriptionPeriodEndIso(obj: StripeWebhookObject): string | null {
  const seconds = subscriptionPeriodEnd(obj);
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/** 請求書がどの契約のものか（旧 API: invoice.subscription、新 API: invoice.parent.subscription_details.subscription） */
export function invoiceSubscriptionId(obj: StripeWebhookObject): string | null {
  const pick = (value: unknown): string | null => {
    if (typeof value === "string" && value) {
      return value;
    }
    const id = (value as { id?: unknown } | null | undefined)?.id;
    return typeof id === "string" && id ? id : null;
  };
  const parent = obj.parent as { subscription_details?: { subscription?: unknown } } | null | undefined;
  return pick(obj.subscription) ?? pick(parent?.subscription_details?.subscription);
}

function invoiceSubscriptionMetadata(obj: StripeWebhookObject): Record<string, string> | undefined {
  const parent = obj.parent as { subscription_details?: { metadata?: Record<string, string> } } | null | undefined;
  const legacy = obj.subscription_details as { metadata?: Record<string, string> } | null | undefined;
  return parent?.subscription_details?.metadata ?? legacy?.metadata ?? undefined;
}

function trialStillActive(row: BillingRowSnapshot | null, now: Date): boolean {
  return Boolean(
    row?.status === "trialing" && row.trial_ends_at && new Date(row.trial_ends_at).getTime() > now.getTime(),
  );
}

/**
 * 請求書払い（collection_method=send_invoice）の契約は、Stripe 上では請求書を送った時点で active になる。
 * KENBEI では入金（invoice.paid）を確認するまで有料にしない。お試し中なら、お試しの期限まではそのまま使える。
 */
export function invoiceBilledStatus(stripeMapped: string, row: BillingRowSnapshot | null, now: Date): string {
  if (trialStillActive(row, now)) {
    return "trialing";
  }
  if (stripeMapped === "active" || stripeMapped === "trialing") {
    return row?.status === "active" ? "active" : (row?.status === "past_due" ? "past_due" : "incomplete");
  }
  return stripeMapped;
}

export function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }
  return error.code === "23505" || Boolean(error.message?.toLowerCase().includes("duplicate"));
}

/** First writer of event_id wins. Concurrent losers are duplicates. */
export async function claimStripeWebhookEvent(
  tryInsert: () => Promise<{ inserted: boolean; uniqueViolation?: boolean; failed?: boolean }>,
): Promise<StripeEventClaim> {
  const result = await tryInsert();
  if (result.inserted) {
    return "claimed";
  }
  if (result.uniqueViolation) {
    return "duplicate";
  }
  return "error";
}

export function createMemoryStripeEventStore() {
  const ids = new Set<string>();
  return {
    tryInsert(eventId: string): { inserted: boolean; uniqueViolation?: boolean } {
      if (ids.has(eventId)) {
        return { inserted: false, uniqueViolation: true };
      }
      ids.add(eventId);
      return { inserted: true };
    },
  };
}

export function organizationIdFromStripeObject(obj: StripeWebhookObject): string | null {
  const meta = obj.metadata as { organization_id?: string; plan_code?: string } | undefined;
  return meta?.organization_id || (obj.client_reference_id as string | undefined) || null;
}

type FunnelAttribution = {
  visitor_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

/** 契約した会社を営業ファネルに「paid」として記録する（カード・請求書払いの両方） */
export async function recordPaidFunnelEvent(
  admin: BillingAdmin,
  organizationId: string,
  planCode: string | null,
  attribution: FunnelAttribution | undefined,
): Promise<void> {
  try {
    await admin
      .from("sales_funnel_events")
      .insert({
        visitor_id: attribution?.visitor_id || `org:${organizationId}`,
        organization_id: organizationId,
        event_kind: "paid",
        utm_source: attribution?.utm_source ?? null,
        utm_medium: attribution?.utm_medium ?? null,
        utm_campaign: attribution?.utm_campaign ?? null,
        utm_content: attribution?.utm_content ?? null,
        utm_term: attribution?.utm_term ?? null,
        plan_code: planCode ? normalizeBillingPlanCode(planCode) : null,
      })
      .select("id")
      .maybeSingle();
  } catch {
    // Funnel table may be missing until the approved migration is applied.
  }
}

export async function applyStripeWebhookBusiness(
  admin: BillingAdmin,
  event: StripeWebhookEvent,
  organizationId: string | null,
  now: Date = new Date(),
): Promise<void> {
  const obj = event.data.object;
  const meta = obj.metadata as { plan_code?: string } | undefined;
  const planCode = meta?.plan_code ? persistableBillingPlanCode(meta.plan_code) : null;

  if (event.type === "checkout.session.completed") {
    const customer = obj.customer as string | undefined;
    const subscription = obj.subscription as string | undefined;
    if (organizationId) {
      await admin.from("organization_billing").upsert({
        organization_id: organizationId,
        stripe_customer_id: customer ?? null,
        stripe_subscription_id: subscription ?? null,
        status: "active",
        trial_ends_at: null,
        ...(planCode ? { plan_code: planCode } : {}),
      });
      await recordPaidFunnelEvent(admin, organizationId, planCode, obj.metadata as Record<string, string> | undefined);
    }
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const status = obj.status as string | undefined;
    const row = organizationId
      ? (await admin.from("organization_billing").select("organization_id, status, trial_ends_at").eq("organization_id", organizationId).maybeSingle()).data
      : (
          await admin
            .from("organization_billing")
            .select("organization_id, status, trial_ends_at")
            .eq("stripe_subscription_id", obj.id as string)
            .maybeSingle()
        ).data;
    const orgId = organizationId || row?.organization_id;
    if (orgId) {
      const stripeMapped =
        event.type === "customer.subscription.deleted" || status === "canceled" || status === "cancelled"
          ? "canceled"
          : status === "past_due" || status === "unpaid" || status === "active" || status === "trialing"
            ? status
            : "active";
      const mapped =
        obj.collection_method === "send_invoice" ? invoiceBilledStatus(stripeMapped, row ?? null, now) : stripeMapped;
      const patch: {
        status: string;
        cancel_at_period_end: boolean;
        current_period_end: string | null;
        plan_code?: string;
        stripe_subscription_id?: null;
      } = {
        status: mapped,
        cancel_at_period_end: Boolean(obj.cancel_at_period_end),
        current_period_end: subscriptionPeriodEndIso(obj),
      };
      if (planCode && mapped !== "canceled") {
        patch.plan_code = planCode;
      }
      if (stripeMapped === "canceled" && mapped === "trialing") {
        // お試し中に請求書払いの申し込みを取り消した：お試しは続け、もう一度申し込めるようにする
        patch.stripe_subscription_id = null;
      }
      await admin.from("organization_billing").update(patch).eq("organization_id", orgId);
    }
  }
  if (event.type === "invoice.paid" && obj.collection_method === "send_invoice" && Number(obj.amount_paid ?? 0) > 0) {
    // 請求書払いは、ここで初めて有料にする（カード払いは checkout.session.completed で有料になる）
    const sub = invoiceSubscriptionId(obj);
    const row = sub
      ? (await admin.from("organization_billing").select("organization_id, status, trial_ends_at").eq("stripe_subscription_id", sub).maybeSingle())
          .data
      : null;
    if (row?.organization_id) {
      await admin.from("organization_billing").update({ status: "active", trial_ends_at: null }).eq("organization_id", row.organization_id);
      const meta = invoiceSubscriptionMetadata(obj);
      const paidPlan = meta?.plan_code ? persistableBillingPlanCode(meta.plan_code) : null;
      await recordPaidFunnelEvent(admin, row.organization_id, paidPlan, meta);
    }
  }
  if (event.type === "invoice.payment_failed") {
    const sub = invoiceSubscriptionId(obj);
    if (sub) {
      const keepTrial =
        obj.collection_method === "send_invoice" &&
        trialStillActive(
          (await admin.from("organization_billing").select("organization_id, status, trial_ends_at").eq("stripe_subscription_id", sub).maybeSingle())
            .data,
          now,
        );
      if (!keepTrial) {
        await admin.from("organization_billing").update({ status: "past_due" }).eq("stripe_subscription_id", sub);
      }
    }
  }
}

export async function claimStripeWebhookEventInDb(
  admin: BillingAdmin,
  event: StripeWebhookEvent,
  organizationId: string | null,
): Promise<StripeEventClaim> {
  const inserted = await admin
    .from("stripe_webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
      organization_id: organizationId,
    })
    .select("event_id")
    .maybeSingle();
  return claimStripeWebhookEvent(async () => {
    if (!inserted.error && inserted.data) {
      return { inserted: true };
    }
    if (isUniqueViolation(inserted.error)) {
      return { inserted: false, uniqueViolation: true };
    }
    return { inserted: false, failed: true };
  });
}
