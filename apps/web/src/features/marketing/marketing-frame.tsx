import Link from "next/link";
import type { ReactNode } from "react";

export function MarketingCta({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const look =
    variant === "primary"
      ? "bg-[var(--kb-ink)] text-white"
      : "bg-white text-[var(--kb-ink)] ring-1 ring-[var(--kb-line)]";
  return (
    <Link
      href={href}
      className={`kb-tap inline-flex min-h-12 items-center justify-center rounded-2xl px-5 text-base font-medium ${look}`}
    >
      {children}
    </Link>
  );
}

export function MarketingHeader() {
  return (
    <header className="flex items-center justify-between gap-3">
      <Link href="/" className="inline-flex min-h-12 items-center gap-2" aria-label="KENBEI">
        <img src="/logo-k.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
        <span className="text-lg font-semibold tracking-tight">KENBEI</span>
      </Link>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href="/login" className="kb-tap inline-flex min-h-12 items-center px-3 text-sm font-medium text-zinc-700">
          ログイン
        </Link>
        <MarketingCta href="/signup">14日間無料で始める</MarketingCta>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--kb-line)] pt-8 text-sm text-zinc-600">
      <p className="font-semibold text-[var(--kb-ink)]">KENBEI</p>
      <p className="mt-1">施工管理・現場管理Webサービス</p>
      <nav className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-5">
        <Link href="/privacy" className="underline">
          プライバシーポリシー
        </Link>
        <Link href="/terms" className="underline">
          利用規約
        </Link>
        <Link href="/contact" className="underline">
          お問い合わせ
        </Link>
      </nav>
      <p className="mt-6 text-zinc-500">© KENBEI</p>
    </footer>
  );
}

export function MarketingFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-6 md:px-8 md:py-10">
      <MarketingHeader />
      <div className="flex-1">{children}</div>
      <div className="mt-16 pb-8">
        <MarketingFooter />
      </div>
    </div>
  );
}
