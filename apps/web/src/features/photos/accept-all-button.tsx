"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptAllProposedPhotosAction } from "@/features/photos/actions";

export function AcceptAllProposedButton({ count }: { count: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (count === 0) {
    return null;
  }
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="rounded-2xl bg-[var(--kb-ink)] font-medium text-white"
        onClick={() => {
          setPending(true);
          void acceptAllProposedPhotosAction().then((result) => {
            setPending(false);
            if ("error" in result) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "反映中…" : `整理案をすべて確定（${count}枚）`}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
