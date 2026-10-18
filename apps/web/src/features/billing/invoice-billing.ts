/**
 * 請求書払い（銀行振込）の契約。
 * Stripe の subscription を collection_method=send_invoice で作ると、毎月の請求書が
 * 請求先メールに届き、お客さんは振込（jp_bank_transfer の専用口座）かカードで払える。
 */

/** 請求書の支払期限（発行日から何日後か）。建設業の「月末締め翌月末払い」に近い30日。 */
export const INVOICE_DAYS_UNTIL_DUE = 30;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InvoiceBillingInput = {
  billingName: string;
  billingEmail: string;
};

export type InvoiceBillingValidation =
  | { ok: true; value: InvoiceBillingInput }
  | { ok: false; error: string };

export function validateInvoiceBillingInput(raw: { billingName?: unknown; billingEmail?: unknown }): InvoiceBillingValidation {
  const billingName = String(raw.billingName ?? "").trim().slice(0, 120);
  const billingEmail = String(raw.billingEmail ?? "").trim().toLowerCase().slice(0, 254);
  if (!billingName) {
    return { ok: false, error: "請求書の宛名（会社名）を入れてください。" };
  }
  if (!EMAIL_PATTERN.test(billingEmail)) {
    return { ok: false, error: "請求書を送るメールアドレスを正しく入れてください。" };
  }
  return { ok: true, value: { billingName, billingEmail } };
}

export function buildInvoiceCustomerParams(input: InvoiceBillingInput & { organizationId: string }): URLSearchParams {
  return new URLSearchParams({
    name: input.billingName,
    email: input.billingEmail,
    "preferred_locales[0]": "ja",
    "metadata[organization_id]": input.organizationId,
  });
}

export function buildInvoiceSubscriptionParams(input: {
  customer: string;
  price: string;
  organizationId: string;
  planCode: string;
  /** false のときはカードだけ（Stripe で銀行振込が有効になっていない場合） */
  bankTransfer: boolean;
  attribution?: Record<string, string>;
  /** お試し中なら、お試しの終わり（UNIX 秒）から請求を始める */
  trialEnd?: number | null;
}): URLSearchParams {
  const params = new URLSearchParams({
    customer: input.customer,
    "items[0][price]": input.price,
    "items[0][quantity]": "1",
    collection_method: "send_invoice",
    days_until_due: String(INVOICE_DAYS_UNTIL_DUE),
    "metadata[organization_id]": input.organizationId,
    "metadata[plan_code]": input.planCode,
    "metadata[billing_method]": "invoice",
  });
  if (input.trialEnd) {
    params.set("trial_end", String(input.trialEnd));
  }
  if (input.bankTransfer) {
    params.set("payment_settings[payment_method_types][0]", "customer_balance");
    params.set("payment_settings[payment_method_types][1]", "card");
    params.set("payment_settings[payment_method_options][customer_balance][funding_type]", "bank_transfer");
    params.set("payment_settings[payment_method_options][customer_balance][bank_transfer][type]", "jp_bank_transfer");
  } else {
    params.set("payment_settings[payment_method_types][0]", "card");
  }
  for (const [key, value] of Object.entries(input.attribution ?? {})) {
    params.set(`metadata[${key}]`, value);
  }
  return params;
}

/** Stripe アカウントで銀行振込（customer_balance）がまだ使えないときのエラーか */
export function isBankTransferUnavailable(error: { message?: string; param?: string } | undefined): boolean {
  if (!error) {
    return false;
  }
  const text = `${error.param ?? ""} ${error.message ?? ""}`.toLowerCase();
  return text.includes("customer_balance") || text.includes("bank_transfer") || text.includes("payment_method_types");
}

const BILLING_STATUSES = new Set(["trialing", "active", "past_due", "canceled", "unpaid", "incomplete"]);

/** organization_billing.status の CHECK 制約に収まる値にする */
export function billingStatusFromSubscription(status: string | undefined): string {
  if (status && BILLING_STATUSES.has(status)) {
    return status;
  }
  if (status === "incomplete_expired") {
    return "canceled";
  }
  return "active";
}

/**
 * 請求書払いを申し込んだ直後の契約の状態。入金（invoice.paid）までは有料にしない。
 * お試し中ならお試しの期限までそのまま使え、お試しが終わっていれば入金待ち（incomplete）にする。
 */
export function invoicePendingBilling(
  row: { status?: string | null; trial_ends_at?: string | null } | null,
  now: Date = new Date(),
): { status: "trialing" | "incomplete"; trial_ends_at: string | null } {
  const trialEndsAt = row?.trial_ends_at ?? null;
  if (row?.status === "trialing" && trialEndsAt && new Date(trialEndsAt).getTime() > now.getTime()) {
    return { status: "trialing", trial_ends_at: trialEndsAt };
  }
  return { status: "incomplete", trial_ends_at: trialEndsAt };
}

/**
 * 請求書払いを申し込み済みで、まだ入金を確認できていないか。
 * カード払いでお試しの終わりから請求する契約（trialing・trial_ends_at なし）は有料扱いなので含めない。
 */
export function isInvoicePaymentPending(input: {
  stripeSubscriptionId: string | null;
  status: string;
  trialEndsAt: string | null;
}): boolean {
  if (!input.stripeSubscriptionId) {
    return false;
  }
  return input.status === "incomplete" || (input.status === "trialing" && Boolean(input.trialEndsAt));
}
