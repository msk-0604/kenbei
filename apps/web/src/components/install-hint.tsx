"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "kb-install-hint-dismissed";

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

/** Phone-only card that explains how to put KENBEI on the home screen. */
export function InstallHint() {
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (dismissed || standalone) {
      return;
    }
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) {
      setPlatform("ios");
    } else if (/Android/i.test(ua)) {
      setPlatform("android");
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!platform) {
    return null;
  }

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage can be blocked; hiding for this visit is enough.
    }
    setPlatform(null);
  }

  return (
    <section className="rounded-3xl bg-[var(--kb-accent-soft)] p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold">ホーム画面に追加すると、1タップで開けます</h2>
        <button type="button" onClick={dismiss} aria-label="閉じる" className="min-h-0 shrink-0 px-1 text-zinc-500">
          ✕
        </button>
      </div>
      {platform === "ios" ? (
        <p className="mt-2 text-sm leading-6 text-zinc-700">
          Safariの下にある <span className="font-medium">共有ボタン（□に↑）</span> →{" "}
          <span className="font-medium">「ホーム画面に追加」</span> を押してください。
        </p>
      ) : promptEvent ? (
        <button
          type="button"
          onClick={() => {
            void promptEvent.prompt().finally(dismiss);
          }}
          className="kb-tap mt-3 min-h-12 w-full rounded-2xl bg-[var(--kb-accent)] font-medium text-white"
        >
          ホーム画面に追加する
        </button>
      ) : (
        <p className="mt-2 text-sm leading-6 text-zinc-700">
          Chromeの右上の <span className="font-medium">︙</span> →{" "}
          <span className="font-medium">「ホーム画面に追加」</span> を押してください。
        </p>
      )}
    </section>
  );
}
