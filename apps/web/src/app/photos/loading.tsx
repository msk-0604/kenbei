export default function PhotosLoading() {
  return (
    <div className="flex flex-col gap-4 pt-1" aria-busy="true" aria-label="読み込み中">
      <div className="h-10 w-28 animate-pulse rounded-2xl bg-white/80 ring-1 ring-[var(--kb-line)]" />
      <div className="h-52 animate-pulse rounded-3xl bg-white/80 ring-1 ring-[var(--kb-line)]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="h-36 animate-pulse rounded-2xl bg-white/80 ring-1 ring-[var(--kb-line)]" />
        <div className="h-36 animate-pulse rounded-2xl bg-white/80 ring-1 ring-[var(--kb-line)]" />
        <div className="h-36 animate-pulse rounded-2xl bg-white/80 ring-1 ring-[var(--kb-line)]" />
        <div className="h-36 animate-pulse rounded-2xl bg-white/80 ring-1 ring-[var(--kb-line)]" />
      </div>
    </div>
  );
}
