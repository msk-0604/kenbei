export default function ProjectsLoading() {
  return (
    <div className="flex flex-col gap-3 pt-1" aria-busy="true" aria-label="読み込み中">
      <div className="h-10 w-24 animate-pulse rounded-2xl bg-white/80 ring-1 ring-[var(--kb-line)]" />
      <div className="h-36 animate-pulse rounded-3xl bg-white/80 ring-1 ring-[var(--kb-line)]" />
      <div className="h-24 animate-pulse rounded-3xl bg-white/80 ring-1 ring-[var(--kb-line)]" />
      <div className="h-24 animate-pulse rounded-3xl bg-white/80 ring-1 ring-[var(--kb-line)]" />
    </div>
  );
}
