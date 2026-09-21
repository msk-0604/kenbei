"use client";

import { useEffect, useState, type ReactNode } from "react";

export function RevealPanel({
  label,
  children,
  openOnHash,
}: {
  label: string;
  children: ReactNode;
  openOnHash?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!openOnHash) {
      return;
    }
    const sync = () => {
      if (window.location.hash === `#${openOnHash}`) {
        setOpen(true);
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [openOnHash]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="kb-tap min-h-12 w-full rounded-2xl bg-white text-base font-medium text-[var(--kb-ink)] ring-1 ring-[var(--kb-line)]"
      >
        {label}
      </button>
    );
  }
  return <div className="flex flex-col gap-3">{children}</div>;
}
