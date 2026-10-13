"use client";

export type CompanyNotifyEvent = {
  event: string;
  siteId?: string;
  itemId?: string;
  scheduleId?: string;
  photoCount?: number;
  status?: string;
  actorName?: string;
};

/** DB保存のあとにサーバーへお知らせを頼む。会社はサーバー側のログイン情報から決まる。 */
export async function notifyCompanyEvent(event: CompanyNotifyEvent): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    await fetch("/api/push/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      signal: controller.signal,
    }).finally(() => window.clearTimeout(timer));
  } catch {
    // お知らせの失敗で主な操作は止めない
  }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}
