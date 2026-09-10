export const SENSITIVE_LOG_KEYS = [
  "password",
  "token",
  "authorization",
  "cookie",
  "secret",
  "apikey",
  "api_key",
  "service_role",
  "serviceRole",
  "anon_key",
  "signedUrl",
  "signed_url",
];

export type RequestLogContext = {
  requestId?: string;
  organizationId?: string;
  userId?: string;
};

export function redactLogValue(key: string, value: unknown): unknown {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (SENSITIVE_LOG_KEYS.some((item) => normalized.includes(item.replace(/[^a-z0-9]/gi, "")))) {
    return "[redacted]";
  }
  return value;
}

export function buildStructuredLog(
  level: "info" | "warn" | "error",
  message: string,
  context: RequestLogContext = {},
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const safeExtra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra)) {
    safeExtra[key] = redactLogValue(key, value);
  }
  return {
    level,
    msg: message,
    request_id: context.requestId || undefined,
    organization_id: context.organizationId || undefined,
    user_id: context.userId || undefined,
    ...safeExtra,
  };
}
