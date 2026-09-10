import { describe, expect, it } from "vitest";
import {
  claimStripeWebhookEvent,
  createMemoryStripeEventStore,
} from "./stripe-webhook";

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
});
