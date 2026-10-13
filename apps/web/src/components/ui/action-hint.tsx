import { cn } from "@/lib/cn";

/** 主ボタン直下の操作補助（1行） */
export function ActionHint({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mt-2 text-center text-base font-medium leading-snug text-gray-600",
        className
      )}
    >
      {children}
    </p>
  );
}
