"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionHint } from "@/components/ui/action-hint";
import { Card } from "@/components/ui/card";
import {
  isPushSupported,
  registerPushServiceWorker,
  urlBase64ToUint8Array,
} from "@/lib/push/client";

type Status = "loading" | "unsupported" | "off" | "on" | "denied";

export function NotificationSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [standaloneHint, setStandaloneHint] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!isPushSupported()) {
        setStatus("unsupported");
        return;
      }

      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean(
          (window.navigator as Navigator & { standalone?: boolean }).standalone
        );
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      setStandaloneHint(isIOS && !isStandalone);

      try {
        const res = await fetch("/api/push/subscribe");
        const data = (await res.json()) as {
          configured?: boolean;
          publicKey?: string | null;
        };
        if (!data.configured || !data.publicKey) {
          setStatus("unsupported");
          setMessage("通知のサーバー設定がまだ完了していません。");
          return;
        }
        setPublicKey(data.publicKey);

        await registerPushServiceWorker();
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();

        if (Notification.permission === "denied") {
          setStatus("denied");
          return;
        }
        setStatus(existing ? "on" : "off");
      } catch {
        setStatus("unsupported");
      }
    })();
  }, []);

  async function enableNotifications() {
    if (!publicKey) return;
    setBusy(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        setMessage("通知が許可されませんでした。端末の設定から許可してください。");
        return;
      }

      const registration =
        (await registerPushServiceWorker()) ??
        (await navigator.serviceWorker.ready);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const json = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "登録に失敗しました");
      }

      setStatus("on");
      setMessage(
        "受け取りをオンにしました。届かないこともあります。アプリ内のお知らせは残ります。"
      );
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "通知の登録に失敗しました"
      );
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      } else {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
      }
      setStatus("off");
      setMessage("通知をオフにしました。");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "通知の解除に失敗しました"
      );
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <Card>
        <p className="text-lg text-gray-600">通知設定を確認しています…</p>
      </Card>
    );
  }

  if (status === "unsupported") {
    return (
      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-navy-950">
          <BellOff className="h-6 w-6" aria-hidden />
          スマホへの通知
        </h2>
        <p className="text-base text-gray-600">
          {message ||
            "この端末では通知機能を使えません。最新のChrome / Safariでお試しください。"}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-navy-950">
        <Bell className="h-6 w-6" aria-hidden />
        スマホへの通知
      </h2>
      <p className="mb-4 text-base leading-relaxed text-gray-600">
        同じ会社の他の人が現場・予定・写真・作業工程を更新したとき、ロック画面でもお知らせします。自分の操作は自分には届きません。
      </p>

      {standaloneHint ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-900">
          iPhoneでは、共有ボタンから「ホーム画面に追加」を押し、追加したアイコンから開いて「通知を受け取る」を押します。
        </p>
      ) : null}

      {status === "denied" ? (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
          通知がブロックされています。端末の設定アプリから KENBEI
          の通知を許可してください。
        </p>
      ) : null}

      {status === "on" ? (
        <div>
          <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-lg font-bold text-green-800">
            通知はオンです
          </p>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            loading={busy}
            onClick={() => void disableNotifications()}
          >
            通知をオフにする
          </Button>
          <ActionHint>通知を止めたいときに押します</ActionHint>
        </div>
      ) : (
        <div>
          <p className="mb-4 rounded-xl bg-gray-100 px-4 py-3 text-lg font-bold text-gray-700">
            通知はオフです
          </p>
          <Button
            type="button"
            fullWidth
            loading={busy}
            disabled={status === "denied"}
            onClick={() => void enableNotifications()}
          >
            通知を受け取る
          </Button>
          <ActionHint>届かないことがあります。届かなくても、お知らせの画面に残ります。</ActionHint>
        </div>
      )}

      {message ? (
        <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-base text-gray-700">
          {message}
        </p>
      ) : null}
    </Card>
  );
}
