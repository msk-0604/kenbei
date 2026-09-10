export type RateLimitResult = { allowed: true } | { allowed: false; reason: "limited" | "unavailable" };

export const RATE_LIMIT_UNAVAILABLE_MESSAGE = "混み合っています。少し待ってからやり直してください。";

export function decideRateLimit(rpc: { data: unknown; error: unknown }): RateLimitResult {
  if (rpc.error) {
    return { allowed: false, reason: "unavailable" };
  }
  return rpc.data === true ? { allowed: true } : { allowed: false, reason: "limited" };
}
