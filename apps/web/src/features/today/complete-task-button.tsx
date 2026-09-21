"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatusAction } from "@/features/site-ops/actions";
import { toUserActionError } from "@/lib/user-error";

export function CompleteTaskButton({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "pending" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={phase !== "idle"}
        aria-busy={phase === "pending"}
        className={`kb-tap min-h-12 rounded-2xl px-4 text-sm font-medium text-white disabled:opacity-70 ${
          phase === "idle" ? "bg-[var(--kb-ink)]" : "bg-emerald-700"
        }`}
        onClick={() => {
          setPhase("pending");
          setError(null);
          void updateTaskStatusAction(taskId, "done", projectId).then((result) => {
            if (result?.error) {
              setError(toUserActionError(result.error, "タスクを更新"));
              setPhase("idle");
              return;
            }
            setPhase("success");
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            window.setTimeout(() => {
              router.refresh();
            }, reduce ? 0 : 900);
          });
        }}
      >
        {phase === "pending" ? "更新中…" : phase === "success" ? "✓ 完了しました" : "完了にする"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
