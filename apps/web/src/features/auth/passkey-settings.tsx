"use client";

import { useEffect, useState } from "react";
import { ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deleteMyPasskeyAction, listMyPasskeysAction, type PasskeyListItem } from "@/features/auth/passkey-actions";
import { canUseDevicePasskey, registerThisDevice } from "@/features/auth/passkey-client";

function formatDay(iso: string | null): string {
  if (!iso) {
    return "まだ使っていません";
  }
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(new Date(iso));
}

/** 設定画面の「顔認証・指紋でログイン」 */
export function PasskeySettings() {
  const [items, setItems] = useState<PasskeyListItem[] | null>(null);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function reload() {
    setItems(await listMyPasskeysAction().catch(() => []));
  }

  useEffect(() => {
    void reload();
    void canUseDevicePasskey().then(setAvailable);
  }, []);

  async function register() {
    setBusy(true);
    setMessage("");
    const result = await registerThisDevice();
    setBusy(false);
    if (result.ok) {
      setMessage("この端末を登録しました。次からは顔認証・指紋で入れます。");
      await reload();
    } else if (!("cancelled" in result && result.cancelled)) {
      setMessage(result.error);
    }
  }

  async function remove(item: PasskeyListItem) {
    if (!window.confirm(`「${item.deviceName}」の顔認証を外しますか？ 外したあとはメールアドレスとパスワードで入ります。`)) {
      return;
    }
    await deleteMyPasskeyAction(item.id);
    await reload();
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <ScanFace className="h-5 w-5 text-navy-900" aria-hidden />
        <h2 className="text-base font-bold text-gray-600">顔認証・指紋でログイン</h2>
      </div>
      <p className="mb-4 text-base leading-relaxed text-gray-600">
        登録したスマホでは、パスワードを入れずに顔認証（Face ID）や指紋で入れます。顔や指紋の情報はスマホの中だけにあり、KENBEI には送られません。
      </p>
      {items && items.length > 0 ? (
        <ul className="mb-4 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-gray-200 px-3 py-2">
              <span className="min-w-0 text-lg">
                <span className="font-bold text-gray-950">{item.deviceName}</span>
                <span className="block text-base text-gray-600">最後に使った日：{formatDay(item.lastUsedAt)}</span>
              </span>
              <button
                type="button"
                onClick={() => void remove(item)}
                className="tap-press min-h-12 shrink-0 rounded-xl border-2 border-red-300 px-3 text-base font-bold text-red-700"
              >
                外す
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {available ? (
        <Button type="button" fullWidth loading={busy} onClick={() => void register()}>
          この端末で顔認証・指紋を使う
        </Button>
      ) : (
        <p className="text-base text-gray-600">この端末では顔認証・指紋が使えません。スマホで開くと登録できます。</p>
      )}
      {message ? <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-base text-gray-800">{message}</p> : null}
    </Card>
  );
}
