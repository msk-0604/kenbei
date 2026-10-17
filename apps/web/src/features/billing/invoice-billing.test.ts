import { describe, expect, it } from "vitest";
import {
  billingStatusFromSubscription,
  buildInvoiceCustomerParams,
  buildInvoiceSubscriptionParams,
  INVOICE_DAYS_UNTIL_DUE,
  isBankTransferUnavailable,
  validateInvoiceBillingInput,
} from "./invoice-billing";

describe("validateInvoiceBillingInput", () => {
  it("trims and lowercases", () => {
    expect(validateInvoiceBillingInput({ billingName: " 山本建設 ", billingEmail: " Keiri@Example.JP " })).toEqual({
      ok: true,
      value: { billingName: "山本建設", billingEmail: "keiri@example.jp" },
    });
  });

  it("requires a name and a valid email", () => {
    expect(validateInvoiceBillingInput({ billingName: "", billingEmail: "a@b.jp" }).ok).toBe(false);
    expect(validateInvoiceBillingInput({ billingName: "山本建設", billingEmail: "keiri" }).ok).toBe(false);
  });
});

describe("buildInvoiceSubscriptionParams", () => {
  const base = { customer: "cus_1", price: "price_1", organizationId: "org-1", planCode: "pro" };

  it("sends a monthly invoice payable by bank transfer or card", () => {
    const params = buildInvoiceSubscriptionParams({ ...base, bankTransfer: true });
    expect(params.get("collection_method")).toBe("send_invoice");
    expect(params.get("days_until_due")).toBe(String(INVOICE_DAYS_UNTIL_DUE));
    expect(params.get("payment_settings[payment_method_types][0]")).toBe("customer_balance");
    expect(params.get("payment_settings[payment_method_types][1]")).toBe("card");
    expect(params.get("payment_settings[payment_method_options][customer_balance][bank_transfer][type]")).toBe(
      "jp_bank_transfer",
    );
    expect(params.get("metadata[organization_id]")).toBe("org-1");
    expect(params.get("metadata[plan_code]")).toBe("pro");
  });

  it("falls back to card only", () => {
    const params = buildInvoiceSubscriptionParams({ ...base, bankTransfer: false });
    expect(params.get("payment_settings[payment_method_types][0]")).toBe("card");
    expect(params.get("payment_settings[payment_method_types][1]")).toBeNull();
    expect(params.toString()).not.toContain("customer_balance");
  });

  it("never sets a Stripe trial", () => {
    expect(buildInvoiceSubscriptionParams({ ...base, bankTransfer: true }).toString()).not.toContain("trial");
  });
});

describe("buildInvoiceCustomerParams", () => {
  it("tags the customer with the organization", () => {
    const params = buildInvoiceCustomerParams({ billingName: "山本建設", billingEmail: "a@b.jp", organizationId: "org-1" });
    expect(params.get("metadata[organization_id]")).toBe("org-1");
    expect(params.get("preferred_locales[0]")).toBe("ja");
  });
});

describe("isBankTransferUnavailable", () => {
  it("detects customer_balance errors", () => {
    expect(isBankTransferUnavailable({ param: "payment_settings[payment_method_types][0]" })).toBe(true);
    expect(isBankTransferUnavailable({ message: "customer_balance is not enabled" })).toBe(true);
    expect(isBankTransferUnavailable({ message: "No such price" })).toBe(false);
    expect(isBankTransferUnavailable(undefined)).toBe(false);
  });
});

describe("billingStatusFromSubscription", () => {
  it("keeps values the DB accepts", () => {
    expect(billingStatusFromSubscription("active")).toBe("active");
    expect(billingStatusFromSubscription("past_due")).toBe("past_due");
    expect(billingStatusFromSubscription("incomplete_expired")).toBe("canceled");
    expect(billingStatusFromSubscription(undefined)).toBe("active");
  });
});
