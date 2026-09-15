"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatusAction } from "@/features/site-ops/actions";

export function CompleteTaskButton({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={phase !== "idle"}
        className={`kb-tap min-h-12 rounded-2xl px-4 text-sm font-medium text-white disabled:opacity-70 ${
          phase === "done" ? "bg-emerald-700" : "bg-[var(--kb-ink)]"
        }`}
        onClick={() => {
          setPhase("pending");
          setError(null);
          void updateTaskStatusAction(taskId, "done", projectId).then((result) => {
            if (result?.error) {
              setError(result.error);
              setPhase("idle");
              return;
            }
            setPhase("done");
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            window.setTimeout(() => {
              router.refresh();
            }, reduce ? 0 : 180);
          });
        }}
      >
        {phase === "pending" ? "完了しています…" : phase === "done" ? "完了しました" : "完了"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
