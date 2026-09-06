"use client";

import { useTransition } from "react";
import { endSiteAction, startSiteAction } from "@/features/today/actions";

export function SiteButtons({
  projectId,
  startedAt,
  endedAt,
}: {
  projectId: string;
  startedAt: string | null;
  endedAt: string | null;
}) {
  const [pending, start] = useTransition();
  const running = Boolean(startedAt) && !endedAt;

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        disabled={pending || running}
        onClick={() =>
          start(() => {
            void startSiteAction(projectId);
          })
        }
        className="rounded-2xl bg-zinc-900 text-base font-medium text-white disabled:opacity-40"
      >
        {running ? "開始済み" : "現場開始"}
      </button>
      <button
        type="button"
        disabled={pending || !running}
        onClick={() =>
          start(() => {
            void endSiteAction(projectId);
          })
        }
        className="rounded-2xl border border-zinc-200 bg-white text-base font-medium disabled:opacity-40"
      >
        現場終了
      </button>
    </div>
  );
}
