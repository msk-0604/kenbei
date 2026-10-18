"use client";

import { useState } from "react";
import { ScanFace } from "lucide-react";
import { useRouter } from "next/navigation";
import { markPasskeyOffer, registerThisDevice } from "@/features/auth/passkey-client";

/** メールでログインした直後に一度だけ出す「次から顔認証で入りますか？」 */
export function PasskeyOffer({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function go() {
    router.replace(nextPath);
    router.refresh();
  }

  async function accept() {
    setBusy(true);
    setError("");
    const result = await registerThisDevice();
    setBusy(false);
    if (result.ok) {
      go();
    } else if (!("cancelled" in result && result.cancelled)) {
      setError(result.error);
    }
  }

  function later() {
    markPasskeyOffer("dismissed");
    go();
  }

  return (
    <div className="space-y-4 rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm">
      <ScanFace className="mx-auto h-12 w-12 text-navy-900" aria-hidden />
      <h1 className="text-center text-2xl font-bold text-navy-950">次から顔認証で入りますか？</h1>
      <p className="text-lg leading-relaxed text-gray-700">
        このスマホを登録すると、次からはパスワードを入れずに、顔認証（Face ID）や指紋だけで入れます。顔や指紋の情報はスマホの中だけにあり、KENBEI には送られません。
      </p>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-base text-red-700">{error}</p> : null}
      <button
        type="button"
        onClick={() => void accept()}
        disabled={busy}
        className="tap-press min-h-14 w-full rounded-2xl bg-navy-900 text-lg font-bold text-white disabled:opacity-60"
      >
        {busy ? "登録しています…" : "顔認証を使う"}
      </button>
      <button type="button" onClick={later} className="tap-press min-h-12 w-full text-lg font-bold text-gray-600 underline">
        あとで（設定からいつでも登録できます）
      </button>
    </div>
  );
}
