import { isKenbeiProductionRuntime, resolveAppUrl } from "@/lib/app-url";

export function getPublicEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }
  return { url, anonKey };
}

export function getAppUrl(): string {
  return resolveAppUrl(process.env.NEXT_PUBLIC_APP_URL, isKenbeiProductionRuntime());
}

export function isSupabaseConfigured(): boolean {
  return getPublicEnv() !== null;
}
