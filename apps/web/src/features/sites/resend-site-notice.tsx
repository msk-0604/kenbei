"use client";

import { useState } from "react";
import { resendSiteNoticeAction } from "@/features/sites/actions";

export function ResendSiteNotice({ projectId }: { projectId: string }) {
  const [message, setMessage] = useState(
    "現場は登録されています。お知らせの作成に失敗したので、もう一度押せます。"
  );
  const [loading, setLoading] = useState(false);

  async function resend() {
    setLoading(true);
    const response = await resendSiteNoticeAction(projectId).catch(() => ({ ok: false }));
    setLoading(false);
    setMessage(
      response.ok
        ? "お知らせを作成しました。"
        : "お知らせはまだ作成できていません。もう一度押せます。"
    );
  }

  return (
    <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <p className="text-lg text-amber-950">{message}</p>
      <button
        type="button"
        disabled={loading}
        onClick={() => void resend()}
        className="mt-3 min-h-14 w-full rounded-2xl bg-gray-900 text-lg font-bold text-white"
      >
        {loading ? "送信中" : "お知らせを再送する"}
      </button>
    </div>
  );
}
