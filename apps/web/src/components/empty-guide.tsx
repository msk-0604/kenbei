import type { ReactNode } from "react";

export function EmptyGuide({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <section className="kb-enter rounded-3xl bg-[var(--kb-card)] p-5 ring-1 ring-[var(--kb-line)]">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
      {action ? <div className="mt-4 flex flex-col gap-3 sm:flex-row">{action}</div> : null}
    </section>
  );
}
