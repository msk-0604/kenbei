import { createHmac, timingSafeEqual } from "node:crypto";

/** Stripe の既定と同じ5分。これより古い（または未来の）署名は、盗まれた通知の再送とみなして受け付けない。 */
export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Stripe-Signature ヘッダー（`t=…,v1=…`）を確かめる。
 * 署名が合っていても、タイムスタンプが許容範囲の外なら false。同じ通知の二重処理は、別に event_id で防いでいる。
 */
export function verifyStripeSignature(
  raw: string,
  header: string | null,
  secret: string,
  options: { nowSeconds?: number; toleranceSeconds?: number } = {},
): boolean {
  if (!header) {
    return false;
  }
  const parts = header.split(",").map((item) => item.trim());
  const timestamp = parts.find((item) => item.startsWith("t="))?.slice(2);
  const signatures = parts.filter((item) => item.startsWith("v1=")).map((item) => item.slice(3));
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) {
    return false;
  }
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = options.toleranceSeconds ?? STRIPE_SIGNATURE_TOLERANCE_SECONDS;
  if (Math.abs(nowSeconds - Number(timestamp)) > tolerance) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  return signatures.some((signature) => {
    try {
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(signature, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}
