export default function Loading() {
  return (
    <div className="flex flex-col gap-4 pt-1" aria-busy="true" aria-label="読み込み中">
      <div className="h-1 overflow-hidden rounded-full bg-zinc-200">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--kb-ink)]" />
      </div>
      <div className="h-24 animate-pulse rounded-3xl bg-white/80 ring-1 ring-[var(--kb-line)]" />
      <div className="h-44 animate-pulse rounded-3xl bg-white/80 ring-1 ring-[var(--kb-line)]" />
      <div className="h-44 animate-pulse rounded-3xl bg-white/80 ring-1 ring-[var(--kb-line)]" />
    </div>
  );
}
