import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

export function createBrowserSupabaseClient() {
  const env = getPublicEnv();
  if (!env) {
    throw new Error("Supabase public env is not configured");
  }
  return createBrowserClient(env.url, env.anonKey);
}
