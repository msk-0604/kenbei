/* KENBEI Service Worker — Web Push 通知 */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "KENBEI",
    body: "更新がありました",
    url: "/today",
    tag: "kenbei-update",
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    // デフォルト文面を使う
  }

  const url =
    typeof data.url === "string" && data.url.startsWith("/")
      ? data.url
      : "/today";

  event.waitUntil(
    self.registration.showNotification(data.title || "KENBEI", {
      body: data.body || "更新がありました",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "kenbei-update",
      renotify: true,
      data: { url },
      requireInteraction: false,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const origin = self.location.origin;
  let target = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/today";
  if (typeof target !== "string" || !target) target = "/today";
  if (target.startsWith("/")) {
    target = origin + target;
  } else if (!target.startsWith(origin)) {
    target = origin + "/today";
  }

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        const clientUrl = client.url || "";
        if (clientUrl.startsWith(origin) && "focus" in client) {
          await client.focus();
          if ("navigate" in client && clientUrl !== target) {
            try {
              await client.navigate(target);
            } catch {
              await self.clients.openWindow(target);
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
