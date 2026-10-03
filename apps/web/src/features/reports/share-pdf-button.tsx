"use client";

import { useState } from "react";

/**
 * Shares the report PDF through the phone's share sheet (LINE, mail, etc.).
 * Where file sharing is not supported (most desktops), it downloads the PDF.
 */
export function SharePdfButton({ reportId, fileName, title }: { reportId: string; fileName: string; title: string }) {
  const [phase, setPhase] = useState<"idle" | "pending" | "downloaded">("idle");
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setPhase("pending");
    setError(null);
    try {
      const res = await fetch(`/api/pdf/report/${reportId}`);
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
        setPhase("idle");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      setPhase("downloaded");
    } catch (cause) {
      setPhase("idle");
      if (cause instanceof DOMException && cause.name === "AbortError") {
        return;
      }
      setError("PDFを用意できませんでした。通信状況を確認して、もう一度押してください。");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void share()}
        disabled={phase === "pending"}
        className="kb-tap min-h-12 rounded-2xl bg-[var(--kb-accent)] font-medium text-white disabled:opacity-60"
      >
        {phase === "pending" ? "PDFを用意中…" : "PDFを送る（LINE・メールなど）"}
      </button>
      {phase === "downloaded" ? (
        <p className="text-sm text-zinc-600">PDFをダウンロードしました。LINEやメールに添付して送ってください。</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
