const SECRET_PATTERN = /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+|\bwhsec_[A-Za-z0-9]+/g;

export function redactStripeSecrets(text: string): string {
  return text.replace(SECRET_PATTERN, "[redacted]");
}

export function summarizeStripeCheckoutFailure(status: number, body: unknown): {
  status: number;
  type: string | null;
  code: string | null;
  message: string;
} {
  const error =
    body && typeof body === "object" && "error" in body
      ? (body as { error?: { type?: unknown; code?: unknown; message?: unknown } }).error
      : undefined;
  const message =
    typeof error?.message === "string" && error.message.trim()
      ? error.message.trim()
      : "Checkout を開始できませんでした。";
  return {
    status,
    type: typeof error?.type === "string" ? error.type : null,
    code: typeof error?.code === "string" ? error.code : null,
    message: redactStripeSecrets(message),
  };
}
