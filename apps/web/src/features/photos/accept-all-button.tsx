"use client";

import { useState } from "react";
import { acceptAllProposedPhotosAction } from "@/features/photos/actions";

export function AcceptAllProposedButton({ count }: { count: number }) {
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
            window.location.reload();
          });
        }}
      >
        {pending ? "????" : `????????????${count}??`}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
