"use client";

import { useFormStatus } from "react-dom";

export function CheckoutSubmitButton({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full min-h-12 rounded-2xl bg-[var(--kb-ink)] py-3 font-medium text-white kb-tap disabled:opacity-50 ${className ?? ""}`}
    >
      {pending ? "処理中…" : label}
    </button>
  );
}
