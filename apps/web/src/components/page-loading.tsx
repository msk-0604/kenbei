/**
 * 読み込み中の骨組み（スケルトン）。本物の画面と同じ形を先に出して、待っている感じを減らす。
 * すぐ読み込みが終わるときはチラつかないよう、少し待ってから出す（.skeleton-screen）。
 */
export function PageLoading({
  label = "読み込み中",
  variant = "list",
}: {
  label?: string;
  variant?: "list" | "schedule" | "detail";
}) {
  return (
    <div className="skeleton-screen space-y-4" aria-busy="true" aria-label={label} role="status">
      <span className="sr-only">{label}</span>
      <div className="skeleton h-9 w-2/3" />
      {variant === "schedule" ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="skeleton h-14" />
            <div className="skeleton h-14" />
            <div className="skeleton h-14" />
          </div>
          <div className="skeleton h-12" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-28" />
          ))}
        </>
      ) : variant === "detail" ? (
        <>
          <div className="skeleton h-5 w-1/2" />
          <div className="skeleton h-40" />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-16" />
            <div className="skeleton h-16" />
          </div>
          <div className="skeleton h-24" />
        </>
      ) : (
        <>
          <div className="skeleton h-14" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </>
      )}
    </div>
  );
}
