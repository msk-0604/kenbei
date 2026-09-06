"use client";

import { acceptPhotoProposalAction } from "@/features/photos/actions";
import { useState } from "react";

export function AcceptPhotoButton({ photoId }: { photoId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="rounded-2xl bg-zinc-900 font-medium text-white"
        onClick={() => {
          setPending(true);
          void acceptPhotoProposalAction(photoId).then((result) => {
            setPending(false);
            setError(result?.error ?? null);
            if (!result?.error) {
              window.location.reload();
            }
          });
        }}
      >
        {pending ? "反映中…" : "この整理で確定"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
