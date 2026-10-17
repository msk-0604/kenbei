"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { lineShareUrl, workerInviteMessage, workerLoginUrl } from "@/features/workers/worker-invite";

/**
 * 作業員への案内。LINE で送るか、印刷して渡せば、作業員が自分で始められる。
 * 合言葉はここに入れても保存しない（文面に書くためだけ）。
 */
export function WorkerInviteKit({ loginCode, companyName }: { loginCode: string; companyName: string }) {
  const [origin, setOrigin] = useState("https://app.kenbei.jp");
  const [passcode, setPasscode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const loginUrl = workerLoginUrl(origin, loginCode);
  const message = workerInviteMessage({ companyName, loginUrl, loginCode, passcode });

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-6 space-y-4 border-t-2 border-gray-100 pt-5">
      <h3 className="text-lg font-bold text-navy-950">作業員に案内する</h3>
      <p className="text-base leading-relaxed text-gray-600">
        この文面を LINE で送るか、案内を印刷して渡してください。作業員は自分で始められます。
      </p>
      <label className="block text-base font-bold text-gray-700" htmlFor="invite-passcode">
        文面に合言葉も書く（任意・保存しません）
      </label>
      <input
        id="invite-passcode"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        autoComplete="off"
        placeholder="書かないときは空のまま"
        className="min-h-12 w-full rounded-xl border-2 border-gray-300 px-3 text-lg"
      />
      <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 font-sans text-base leading-relaxed text-gray-800">
        {message}
      </pre>
      <div className="grid gap-3 sm:grid-cols-3">
        <a
          href={lineShareUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          className="tap-press flex min-h-14 items-center justify-center rounded-2xl bg-[#06C755] px-4 text-lg font-bold text-white"
        >
          LINE で送る
        </a>
        <button
          type="button"
          onClick={() => void copy()}
          className="tap-press min-h-14 rounded-2xl border-2 border-gray-300 bg-white px-4 text-lg font-bold text-gray-900"
        >
          {copied ? "コピーしました" : "文面をコピー"}
        </button>
        <Link
          href="/kanri/worker-guide/print"
          className="tap-press flex min-h-14 items-center justify-center rounded-2xl border-2 border-gray-300 bg-white px-4 text-lg font-bold text-gray-900"
        >
          印刷用の案内（QR付き）
        </Link>
      </div>
    </div>
  );
}
