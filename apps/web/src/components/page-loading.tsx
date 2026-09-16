export function PageLoading({ label = "読み込み中" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20" aria-busy="true" aria-label={label}>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-zinc-200">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--kb-ink)]" />
      </div>
      <p className="text-sm text-zinc-500">{label}</p>
    </div>
  );
}
