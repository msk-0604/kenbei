import type { ReactNode } from "react";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="text-3xl font-semibold tracking-tight text-[var(--kb-ink)]">KENBEI</p>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-base leading-7 text-zinc-600">{description}</p>
      <div className="mt-8">{children}</div>
    </main>
  );
}
