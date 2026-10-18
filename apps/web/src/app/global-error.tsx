"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** 画面全体が描けなかったとき。Sentry に送り、やり直しボタンを出す。 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ja">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "48px 16px", textAlign: "center", background: "#fff", color: "#111" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>画面を表示できませんでした</h1>
        <p style={{ marginTop: 12, color: "#555" }}>少し待ってから、もう一度お試しください。直らないときは support@kenbei.jp へご連絡ください。</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{ marginTop: 24, minHeight: 48, padding: "0 24px", borderRadius: 16, background: "#111", color: "#fff", fontWeight: 700 }}
        >
          もう一度読み込む
        </button>
      </body>
    </html>
  );
}
