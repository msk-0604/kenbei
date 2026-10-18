import { describe, expect, it } from "vitest";
import {
  applyStripeWebhookBusiness,
  claimStripeWebhookEvent,
  createMemoryStripeEventStore,
  invoiceBilledStatus,
  invoiceSubscriptionId,
  subscriptionPeriodEnd,
  subscriptionPeriodEndIso,
  type StripeWebhookEvent,
} from "./stripe-webhook";

function memoryBilling(row: Record<string, unknown> = { organization_id: "org_1" }) {
  const writes: { op: string; table: string; row: Record<string, unknown> }[] = [];
  return {
    writes,
    from(table: string) {
      return {
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            maybeSingle: async () => {
              writes.push({ op: "insert", table, row });
              return { data: { event_id: row.event_id }, error: null };
            },
          }),
        }),
        upsert: async (row: Record<string, unknown>) => {
          writes.push({ op: "upsert", table, row });
        },
        update: (row: Record<string, unknown>) => ({
          eq: async () => {
            writes.push({ op: "update", table, row });
          },
        }),
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: row as { organization_id: string } }),
          }),
        }),
      };
    },
  };
}

function event(type: string, object: Record<string, unknown>): StripeWebhookEvent {
  return { id: `evt_${type}`, type, data: { object } };
}

describe("stripe webhook insert-first", () => {
  it("runs business processing once when the same event arrives in parallel", async () => {
    const store = createMemoryStripeEventStore();
    let processed = 0;

    const run = async () => {
      const claim = await claimStripeWebhookEvent(async () => store.tryInsert("evt_parallel"));
      if (claim === "claimed") {
        processed += 1;
      }
      return claim;
    };

    const results = await Promise.all([run(), run(), run()]);
    expect(results.filter((item) => item === "claimed")).toHaveLength(1);
    expect(results.filter((item) => item === "duplicate")).toHaveLength(2);
    expect(processed).toBe(1);
  });

  it("maps checkout, subscription update, cancel, and failed invoice", async () => {
    const admin = memoryBilling();
    await applyStripeWebhookBusiness(
      admin,
      event("checkout.session.completed", {
        customer: "cus_1",
        subscription: "sub_1",
        metadata: { organization_id: "org_1", plan_code: "standard" },
        client_reference_id: "org_1",
      }),
      "org_1",
    );
    expect(admin.writes[0]).toMatchObject({
      op: "upsert",
      table: "organization_billing",
      row: { organization_id: "org_1", plan_code: "pro", status: "active", trial_ends_at: null },
    });
    expect(admin.writes.some((item) => item.table === "sales_funnel_events" && item.row.event_kind === "paid")).toBe(true);

    await applyStripeWebhookBusiness(
      admin,
      event("checkout.session.completed", {
        customer: "cus_2",
        subscription: "sub_2",
        metadata: { organization_id: "org_2", plan_code: "business" },
        client_reference_id: "org_2",
      }),
      "org_2",
    );
    expect(admin.writes.some((item) => item.row.plan_code === "business" && item.row.status === "active")).toBe(true);

    await applyStripeWebhookBusiness(
      admin,
      event("customer.subscription.updated", {
        id: "sub_1",
        status: "active",
        cancel_at_period_end: true,
        current_period_end: 1_800_000_000,
        metadata: { organization_id: "org_1", plan_code: "pro" },
      }),
      "org_1",
    );
    expect(
      admin.writes.some(
        (item) => item.op === "update" && item.row.status === "active" && item.row.cancel_at_period_end === true,
      ),
    ).toBe(true);

    await applyStripeWebhookBusiness(
      admin,
      event("customer.subscription.deleted", {
        id: "sub_1",
        status: "canceled",
        cancel_at_period_end: false,
        metadata: { organization_id: "org_1" },
      }),
      "org_1",
    );
    const canceled = admin.writes.find((item) => item.op === "update" && item.row.status === "canceled");
    expect(canceled).toBeTruthy();
    expect(canceled?.row.plan_code).toBeUndefined();
    expect(canceled?.row.status).not.toBe("active");
    expect(
      admin.writes.some((item) => item.row.plan_code === "free" && item.row.status === "active"),
    ).toBe(false);

    await applyStripeWebhookBusiness(
      admin,
      event("invoice.payment_failed", { subscription: "sub_1" }),
      "org_1",
    );
    expect(admin.writes.some((item) => item.op === "update" && item.row.status === "past_due")).toBe(true);
  });
});

describe("next renewal date across Stripe API versions", () => {
  it("reads the legacy top-level current_period_end", () => {
    expect(subscriptionPeriodEnd({ current_period_end: 1_800_000_000 })).toBe(1_800_000_000);
  });

  it("reads items.data[].current_period_end (2025-03-31 and later)", () => {
    expect(
      subscriptionPeriodEnd({ items: { data: [{ current_period_end: 1_800_000_000 }, { current_period_end: 1_800_086_400 }] } }),
    ).toBe(1_800_086_400);
    expect(subscriptionPeriodEndIso({ items: { data: [{ current_period_end: 1_800_000_000 }] } })).toBe(
      new Date(1_800_000_000 * 1000).toISOString(),
    );
  });

  it("returns null when neither is present", () => {
    expect(subscriptionPeriodEnd({})).toBeNull();
    expect(subscriptionPeriodEndIso({ items: { data: [] } })).toBeNull();
  });

  it("stores the new-API renewal date on subscription.updated", async () => {
    const admin = memoryBilling({ organization_id: "org_1", status: "active" });
    await applyStripeWebhookBusiness(
      admin,
      event("customer.subscription.updated", {
        id: "sub_1",
        status: "active",
        items: { data: [{ current_period_end: 1_800_000_000 }] },
        metadata: { organization_id: "org_1" },
      }),
      "org_1",
    );
    expect(admin.writes.at(-1)?.row.current_period_end).toBe(new Date(1_800_000_000 * 1000).toISOString());
  });
});

describe("invoice subscription id across Stripe API versions", () => {
  it("reads legacy and new invoice shapes", () => {
    expect(invoiceSubscriptionId({ subscription: "sub_old" })).toBe("sub_old");
    expect(invoiceSubscriptionId({ subscription: { id: "sub_obj" } })).toBe("sub_obj");
    expect(invoiceSubscriptionId({ parent: { subscription_details: { subscription: "sub_new" } } })).toBe("sub_new");
    expect(invoiceSubscriptionId({})).toBeNull();
  });
});

describe("invoice billing becomes paid only after the invoice is paid", () => {
  const now = new Date("2026-10-18T00:00:00Z");
  const inTrial = { organization_id: "org_1", status: "trialing", trial_ends_at: "2026-10-30T00:00:00Z" };
  const trialOver = { organization_id: "org_1", status: "trialing", trial_ends_at: "2026-10-01T00:00:00Z" };
  const pending = { organization_id: "org_1", status: "incomplete", trial_ends_at: null };

  it("keeps the trial while it lasts, whatever Stripe says", () => {
    expect(invoiceBilledStatus("active", inTrial, now)).toBe("trialing");
    expect(invoiceBilledStatus("canceled", inTrial, now)).toBe("trialing");
    expect(invoiceBilledStatus("past_due", inTrial, now)).toBe("trialing");
  });

  it("canceling an unpaid invoice subscription during the trial keeps the trial and allows re-applying", async () => {
    const admin = memoryBilling(inTrial);
    await applyStripeWebhookBusiness(
      admin,
      event("customer.subscription.deleted", { id: "sub_inv", status: "canceled", collection_method: "send_invoice", metadata: { organization_id: "org_1" } }),
      "org_1",
      now,
    );
    expect(admin.writes.at(-1)?.row).toMatchObject({ status: "trialing", stripe_subscription_id: null });
  });

  it("does not turn Stripe's 'active' into paid before payment", () => {
    expect(invoiceBilledStatus("active", trialOver, now)).toBe("incomplete");
    expect(invoiceBilledStatus("active", pending, now)).toBe("incomplete");
    expect(invoiceBilledStatus("active", null, now)).toBe("incomplete");
    expect(invoiceBilledStatus("active", { organization_id: "org_1", status: "past_due" }, now)).toBe("past_due");
  });

  it("keeps a paid company paid, and passes downgrades through", () => {
    const paid = { organization_id: "org_1", status: "active", trial_ends_at: null };
    expect(invoiceBilledStatus("active", paid, now)).toBe("active");
    expect(invoiceBilledStatus("past_due", paid, now)).toBe("past_due");
    expect(invoiceBilledStatus("canceled", paid, now)).toBe("canceled");
  });

  it("subscription.updated for an unpaid invoice subscription stays unpaid", async () => {
    const admin = memoryBilling(pending);
    await applyStripeWebhookBusiness(
      admin,
      event("customer.subscription.updated", {
        id: "sub_inv",
        status: "active",
        collection_method: "send_invoice",
        metadata: { organization_id: "org_1", plan_code: "standard" },
      }),
      "org_1",
      now,
    );
    expect(admin.writes.at(-1)).toMatchObject({ op: "update", row: { status: "incomplete" } });
  });

  it("invoice.paid makes the company paid and records the paid funnel event", async () => {
    const admin = memoryBilling(pending);
    await applyStripeWebhookBusiness(
      admin,
      event("invoice.paid", {
        collection_method: "send_invoice",
        amount_paid: 18000,
        parent: {
          subscription_details: { subscription: "sub_inv", metadata: { organization_id: "org_1", plan_code: "standard", utm_source: "form" } },
        },
      }),
      null,
      now,
    );
    expect(admin.writes.find((item) => item.table === "organization_billing")).toMatchObject({
      op: "update",
      row: { status: "active", trial_ends_at: null },
    });
    const paid = admin.writes.find((item) => item.table === "sales_funnel_events");
    expect(paid?.row).toMatchObject({ event_kind: "paid", organization_id: "org_1", utm_source: "form" });
  });

  it("ignores invoice.paid for card subscriptions and zero-amount invoices", async () => {
    const admin = memoryBilling(pending);
    await applyStripeWebhookBusiness(admin, event("invoice.paid", { subscription: "sub_card", amount_paid: 18000 }), null, now);
    await applyStripeWebhookBusiness(
      admin,
      event("invoice.paid", { subscription: "sub_inv", collection_method: "send_invoice", amount_paid: 0 }),
      null,
      now,
    );
    expect(admin.writes).toHaveLength(0);
  });

  it("a failed invoice payment does not end a running trial", async () => {
    const admin = memoryBilling(inTrial);
    await applyStripeWebhookBusiness(
      admin,
      event("invoice.payment_failed", { subscription: "sub_inv", collection_method: "send_invoice" }),
      null,
      now,
    );
    expect(admin.writes).toHaveLength(0);
  });

  it("card subscriptions keep the existing behaviour (active is active)", async () => {
    const admin = memoryBilling({ organization_id: "org_1", status: "trialing", trial_ends_at: "2026-10-30T00:00:00Z" });
    await applyStripeWebhookBusiness(
      admin,
      event("customer.subscription.updated", { id: "sub_card", status: "active", metadata: { organization_id: "org_1" } }),
      "org_1",
      now,
    );
    expect(admin.writes.at(-1)?.row.status).toBe("active");
  });
});
