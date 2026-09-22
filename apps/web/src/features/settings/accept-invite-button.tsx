"use client";

import Link from "next/link";
import { useState } from "react";
import { acceptInviteAction } from "@/features/settings/actions";

export function AcceptInviteButton({ token, companyName }: { token: string; companyName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (joined) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-base font-medium">✓ {joined}に参加しました</p>
        <Link
          href="/"
          className="flex items-center justify-center rounded-2xl bg-[var(--kb-ink)] font-medium text-white"
        >
          今日へ
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={pending}
        className="rounded-2xl bg-[var(--kb-ink)] font-medium text-white"
        onClick={() => {
          setPending(true);
          void acceptInviteAction(token).then((result) => {
            if (result && "joined" in result) {
              setJoined(result.joined);
              setPending(false);
              return;
            }
            setPending(false);
            setError(result && "error" in result ? result.error : "会社に参加できませんでした。");
          });
        }}
      >
        {pending ? "参加中…" : `${companyName}に参加する`}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
