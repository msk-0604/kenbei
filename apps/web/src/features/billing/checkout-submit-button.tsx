"use client";

import { useFormStatus } from "react-dom";

export function CheckoutSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-zinc-900 py-3 font-medium text-white disabled:opacity-50"
    >
      {pending ? "処理中…" : label}
    </button>
  );
}
