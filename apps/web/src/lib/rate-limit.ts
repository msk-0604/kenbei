import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function consumeRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient();
    const seconds = Math.max(1, Math.ceil(windowMs / 1000));
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: seconds,
    });
    if (error) {
      return true;
    }
    return data === true;
  } catch {
    return true;
  }
}
