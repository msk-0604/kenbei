"use client";

import { useEffect, useState } from "react";

type Ready = { kind: "ready"; file: File } | { kind: "loading" } | { kind: "failed"; status: number | null };

/**
 * Shares the report PDF through the phone's share sheet (LINE, mail, etc.).
 * iOS Safari only opens the share sheet straight from a tap, so the PDF is
 * fetched when the page opens and shared without awaiting anything first.
 * Where file sharing is not supported (most desktops), it downloads the PDF.
 */
export function SharePdfButton({ reportId, fileName, title }: { reportId: string; fileName: string; title: string }) {
  const url = `/api/pdf/report/${reportId}`;
  const [pdf, setPdf] = useState<Ready>({ kind: "loading" });
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          throw res.status;
        }
        const blob = await res.blob();
        if (!cancelled) {
          setPdf({ kind: "ready", file: new File([blob], fileName, { type: "application/pdf" }) });
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setPdf({ kind: "failed", status: typeof cause === "number" ? cause : null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url, fileName]);

  function download(file: File) {
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setNote("PDFをダウンロードしました。LINEやメールに添付して送ってください。");
  }

  function share() {
    setNote(null);
    if (pdf.kind === "failed") {
      // Let the browser open the PDF itself; its own share button still works.
      window.location.href = url;
      return;
    }
    if (pdf.kind !== "ready") {
      return;
    }
    const data = { files: [pdf.file], title };
    if (typeof navigator.canShare === "function" && navigator.canShare(data)) {
      navigator.share(data).catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          return;
        }
        download(pdf.file);
      });
      return;
    }
    download(pdf.file);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={share}
        disabled={pdf.kind === "loading"}
        className="kb-tap min-h-12 rounded-2xl bg-[var(--kb-accent)] font-medium text-white disabled:opacity-60"
      >
        {pdf.kind === "loading" ? "PDFを準備中…" : "PDFを送る（LINE・メールなど）"}
      </button>
      {pdf.kind === "failed" ? (
        <p className="text-sm text-red-600">
          PDFの作成に失敗しました{pdf.status ? `（コード ${pdf.status}）` : ""}。ボタンを押すとPDFを直接開きます。
        </p>
      ) : null}
      {note ? <p className="text-sm text-zinc-600">{note}</p> : null}
    </div>
  );
}
