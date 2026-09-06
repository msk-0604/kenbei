import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "./env";

const CHUNK = 1800;
const memoryStore = new Map<string, string>();

function countKey(key: string): string {
  return `${key}.n`;
}

function partKey(key: string, index: number): string {
  return `${key}.${index}`;
}

const authStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === "web") {
      return memoryStore.get(key) ?? null;
    }
    const nRaw = await SecureStore.getItemAsync(countKey(key));
    if (nRaw) {
      const n = Number(nRaw);
      if (!Number.isFinite(n) || n < 1) {
        return null;
      }
      const parts: string[] = [];
      for (let i = 0; i < n; i += 1) {
        parts.push((await SecureStore.getItemAsync(partKey(key, i))) ?? "");
      }
      return parts.join("");
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      memoryStore.set(key, value);
      return;
    }
    await authStorage.removeItem(key);
    const n = Math.max(1, Math.ceil(value.length / CHUNK));
    await SecureStore.setItemAsync(countKey(key), String(n));
    for (let i = 0; i < n; i += 1) {
      await SecureStore.setItemAsync(partKey(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      memoryStore.delete(key);
      return;
    }
    const nRaw = await SecureStore.getItemAsync(countKey(key));
    const n = nRaw ? Number(nRaw) : 0;
    if (Number.isFinite(n) && n > 0) {
      for (let i = 0; i < n; i += 1) {
        await SecureStore.deleteItemAsync(partKey(key, i));
      }
      await SecureStore.deleteItemAsync(countKey(key));
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const url = isSupabaseConfigured() ? getSupabaseUrl() : "https://placeholder.supabase.co";
const anonKey = isSupabaseConfigured() ? getSupabaseAnonKey() : "placeholder";

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
