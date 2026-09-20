import { describe, expect, it } from "vitest";
import {
  applyStripeWebhookBusiness,
  claimStripeWebhookEvent,
  createMemoryStripeEventStore,
  type StripeWebhookEvent,
} from "./stripe-webhook";

function memoryBilling() {
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
            maybeSingle: async () => ({ data: { organization_id: "org_1" } }),
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
