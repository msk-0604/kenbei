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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        className="min-h-12 rounded-2xl bg-[var(--kb-ink)] px-4 text-sm font-medium text-white disabled:opacity-40"
        onClick={() => {
          setPending(true);
          setError(null);
          void updateTaskStatusAction(taskId, "done", projectId).then((result) => {
            setPending(false);
            if (result?.error) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "完了しています…" : "完了"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
