import { createServerSupabaseClient } from "@/lib/supabase/server";
import { decideRateLimit, type RateLimitResult } from "@/lib/rate-limit-policy";

export { decideRateLimit, RATE_LIMIT_UNAVAILABLE_MESSAGE, type RateLimitResult } from "@/lib/rate-limit-policy";

export async function consumeRateLimit(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const seconds = Math.max(1, Math.ceil(windowMs / 1000));
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: seconds,
    });
    return decideRateLimit({ data, error });
  } catch {
    return { allowed: false, reason: "unavailable" };
  }
}
