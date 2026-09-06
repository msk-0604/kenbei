import Constants from "expo-constants";

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  appUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

function isPlaceholder(value: string): boolean {
  return !value || value.includes("YOUR_PROJECT") || value.includes("YOUR_ANON");
}

export function getSupabaseUrl(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? "";
}

export function getSupabaseAnonKey(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? "";
}

export function getAppUrl(): string {
  return process.env.EXPO_PUBLIC_APP_URL ?? extra.appUrl ?? "http://localhost:3000";
}

export function isSupabaseConfigured(): boolean {
  return !isPlaceholder(getSupabaseUrl()) && !isPlaceholder(getSupabaseAnonKey());
}
