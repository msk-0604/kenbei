"use client";

import { useEffect, useState } from "react";
import { ScanFace } from "lucide-react";
import { useRouter } from "next/navigation";
import { canUseDevicePasskey, signInWithPasskey } from "@/features/auth/passkey-client";

/** ログイン画面の「顔認証で入る」。顔認証・指紋が使える端末にだけ出す。 */
export function PasskeyLoginButton({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void canUseDevicePasskey().then(setAvailable);
  }, []);

  if (!available) {
    return null;
  }

  async function handleClick() {
    setBusy(true);
    setError("");
    const result = await signInWithPasskey();
    if (result.ok) {
      router.replace(nextPath ?? "/");
      router.refresh();
      return;
    }
    setBusy(false);
    if (!("cancelled" in result && result.cancelled)) {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy}
        className="tap-press flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-navy-900 px-4 text-lg font-bold text-white disabled:opacity-60"
      >
        <ScanFace className="h-6 w-6" aria-hidden />
        {busy ? "確認しています…" : "顔認証・指紋で入る"}
      </button>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-base text-red-700">{error}</p> : null}
    </div>
  );
}
