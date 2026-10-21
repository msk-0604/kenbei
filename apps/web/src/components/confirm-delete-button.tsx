"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 「消す」ボタン。押すと確認してから、サーバーの処理を呼ぶ。
 * 消したあとは afterHref へ移る（なければ画面を読み直す）。
 */
export function ConfirmDeleteButton({
  action,
  label,
  confirmText,
  afterHref,
  pendingLabel = "消しています…",
  tone = "danger",
}: {
  action: () => Promise<{ error: string } | null>;
  label: string;
  confirmText: string;
  afterHref?: string;
  pendingLabel?: string;
  tone?: "danger" | "plain";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const look =
    tone === "danger"
      ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
      : "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50";
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        className={`kb-tap min-h-12 w-full rounded-2xl px-4 font-medium disabled:opacity-60 ${look}`}
        onClick={() => {
          if (!window.confirm(confirmText)) return;
          setPending(true);
          setError(null);
          void action().then((result) => {
            if (result?.error) {
              setError(result.error);
              setPending(false);
              return;
            }
            if (afterHref) {
              router.replace(afterHref);
            }
            router.refresh();
          });
        }}
      >
        {pending ? pendingLabel : label}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
