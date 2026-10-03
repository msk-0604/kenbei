"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { proposePhotoAssistAction } from "@/features/photos/actions";

export function PhotoAssistButton({ photoId }: { photoId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-zinc-200"
        onClick={() => {
          setPending(true);
          void proposePhotoAssistAction(photoId).then((result) => {
            setPending(false);
            setError(result?.error ?? null);
            if (!result?.error) {
              router.refresh();
            }
          });
        }}
      >
        {pending ? "提案中…" : "説明の候補を出す"}
      </button>
      <p className="mt-2 text-xs text-zinc-500">確定はしません。下の「この整理で確定」が必要です。</p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
