import { persistableBillingPlanCode } from "@kensapo/domain";

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
      eq: (
        column: string,
        value: string,
      ) => { maybeSingle: () => Promise<{ data: { organization_id: string } | null }> };
    };
  };
};

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

export async function applyStripeWebhookBusiness(
  admin: BillingAdmin,
  event: StripeWebhookEvent,
  organizationId: string | null,
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
        ...(planCode ? { plan_code: planCode } : {}),
      });
    }
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const status = obj.status as string | undefined;
    const org =
      organizationId ||
      (
        await admin
          .from("organization_billing")
          .select("organization_id")
          .eq("stripe_subscription_id", obj.id as string)
          .maybeSingle()
      ).data;
    const orgId = typeof org === "string" ? org : org?.organization_id;
    if (orgId) {
      const mapped =
        event.type === "customer.subscription.deleted"
          ? "canceled"
          : status === "past_due" || status === "unpaid" || status === "active" || status === "trialing"
            ? status
            : "active";
      const patch: {
        status: string;
        cancel_at_period_end: boolean;
        current_period_end: string | null;
        plan_code?: string;
      } = {
        status: mapped,
        cancel_at_period_end: Boolean(obj.cancel_at_period_end),
        current_period_end: obj.current_period_end
          ? new Date(Number(obj.current_period_end) * 1000).toISOString()
          : null,
      };
      if (mapped === "canceled") {
        patch.plan_code = "free";
      } else if (planCode) {
        patch.plan_code = planCode;
      }
      await admin.from("organization_billing").update(patch).eq("organization_id", orgId);
    }
  }
  if (event.type === "invoice.payment_failed") {
    const sub = obj.subscription as string | undefined;
    if (sub) {
      await admin.from("organization_billing").update({ status: "past_due" }).eq("stripe_subscription_id", sub);
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
