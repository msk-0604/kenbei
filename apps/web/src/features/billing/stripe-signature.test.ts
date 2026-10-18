import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { STRIPE_SIGNATURE_TOLERANCE_SECONDS, verifyStripeSignature } from "./stripe-signature";

const secret = "whsec_test";
const raw = JSON.stringify({ id: "evt_1", type: "invoice.paid" });

function header(timestamp: number, body = raw, key = secret): string {
  const signature = createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("verifyStripeSignature", () => {
  const now = 1_800_000_000;

  it("accepts a fresh, correctly signed event", () => {
    expect(verifyStripeSignature(raw, header(now), secret, { nowSeconds: now })).toBe(true);
    expect(verifyStripeSignature(raw, header(now - 299), secret, { nowSeconds: now })).toBe(true);
  });

  it("rejects a correctly signed event outside the tolerance (replay)", () => {
    expect(verifyStripeSignature(raw, header(now - STRIPE_SIGNATURE_TOLERANCE_SECONDS - 1), secret, { nowSeconds: now })).toBe(false);
    expect(verifyStripeSignature(raw, header(now + STRIPE_SIGNATURE_TOLERANCE_SECONDS + 1), secret, { nowSeconds: now })).toBe(false);
  });

  it("rejects a wrong secret, a changed body, and broken headers", () => {
    expect(verifyStripeSignature(raw, header(now, raw, "whsec_other"), secret, { nowSeconds: now })).toBe(false);
    expect(verifyStripeSignature(`${raw} `, header(now), secret, { nowSeconds: now })).toBe(false);
    expect(verifyStripeSignature(raw, null, secret, { nowSeconds: now })).toBe(false);
    expect(verifyStripeSignature(raw, "v1=abc", secret, { nowSeconds: now })).toBe(false);
    expect(verifyStripeSignature(raw, `t=abc,v1=00`, secret, { nowSeconds: now })).toBe(false);
  });

  it("accepts any matching v1 signature when Stripe sends several (secret rotation)", () => {
    const good = header(now).split(",")[1];
    expect(verifyStripeSignature(raw, `t=${now},v1=${"0".repeat(64)},${good}`, secret, { nowSeconds: now })).toBe(true);
  });
});
