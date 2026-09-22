import "server-only";

import { resendMailRequest, type KenbeiMailInput } from "@/lib/mail-request";
import { readServerEnv } from "@/lib/server-env";

export async function sendKenbeiEmail(input: KenbeiMailInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = readServerEnv("RESEND_API_KEY");
  const from = readServerEnv("RESEND_FROM") || "KENBEI <support@kenbei.jp>";
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }
  const request = resendMailRequest({ ...input, apiKey, from });
  const response = await fetch(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
  });
  if (!response.ok) {
    return { ok: false, error: `resend ${response.status}` };
  }
  return { ok: true };
}
