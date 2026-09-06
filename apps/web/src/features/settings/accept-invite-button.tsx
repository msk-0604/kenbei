"use client";

import { useState } from "react";
import { acceptInviteAction } from "@/features/settings/actions";

export function AcceptInviteButton({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={pending}
        className="rounded-2xl bg-[var(--kb-ink)] font-medium text-white"
        onClick={() => {
          setPending(true);
          void acceptInviteAction(token).then((result) => {
            if (result?.error) {
              setPending(false);
              setError(result.error);
            }
          });
        }}
      >
        {pending ? "??????" : "?????????"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
