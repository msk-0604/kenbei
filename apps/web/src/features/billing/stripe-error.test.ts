import { describe, expect, it } from "vitest";
import { redactStripeSecrets, summarizeStripeCheckoutFailure } from "./stripe-error";

describe("summarizeStripeCheckoutFailure", () => {
  it("keeps Stripe type, code, and message without secret keys", () => {
    expect(
      summarizeStripeCheckoutFailure(400, {
        error: {
          type: "invalid_request_error",
          code: "resource_missing",
          message: "No such price: 'price_abc'",
        },
      }),
    ).toEqual({
      status: 400,
      type: "invalid_request_error",
      code: "resource_missing",
      message: "No such price: 'price_abc'",
    });
  });

  it("redacts secret-looking tokens in Stripe messages", () => {
    expect(redactStripeSecrets("key sk_live_abc123xyz used")).toBe("key [redacted] used");
    expect(
      summarizeStripeCheckoutFailure(401, {
        error: { message: "Invalid API Key provided: sk_test_secretvalue" },
      }).message,
    ).toBe("Invalid API Key provided: [redacted]");
  });

  it("falls back when the body has no Stripe error", () => {
    expect(summarizeStripeCheckoutFailure(502, {})).toMatchObject({
      status: 502,
      type: null,
      code: null,
      message: "Checkout を開始できませんでした。",
    });
  });
});
