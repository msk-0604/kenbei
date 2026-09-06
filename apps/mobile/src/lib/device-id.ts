import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const KEY = "kenbei.device-id";

export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY);
  if (existing) {
    return existing;
  }
  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(KEY, created);
  return created;
}
