import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";

const variants: Record<Variant, string> = {
  primary:
    "bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 border-2 border-navy-900",
  secondary:
    "bg-white text-navy-900 border-2 border-gray-300 hover:bg-gray-50 active:bg-gray-100",
};

export function ActionLink({
  href,
  children,
  variant = "primary",
  description,
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  description?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      prefetch
      className={cn(
        "tap-press flex min-h-[5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl px-6 py-5 text-center transition-colors",
        variants[variant],
        className
      )}
    >
      <span className="text-2xl font-bold leading-snug">{children}</span>
      {description ? (
        <span
          className={cn(
            "text-lg font-normal leading-snug",
            variant === "primary" ? "text-white/85" : "text-gray-600"
          )}
        >
          {description}
        </span>
      ) : null}
    </Link>
  );
}
