export function LoadingScreen({
  message = "読み込み中です。少々お待ちください。",
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-13rem-env(safe-area-inset-bottom))] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="h-14 w-14 animate-spin rounded-full border-4 border-navy-900 border-t-transparent" />
      <p className="text-lg leading-relaxed text-gray-600">{message}</p>
    </div>
  );
}
