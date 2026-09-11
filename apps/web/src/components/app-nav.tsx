"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export const MOBILE_NAV = [
  { href: "/", label: "今日", icon: "today" },
  { href: "/projects", label: "現場", icon: "site" },
  { href: "/photos", label: "写真", icon: "photo" },
  { href: "/strategist", label: "軍師", icon: "ai" },
  { href: "/confirm", label: "確認", icon: "check" },
  { href: "/account", label: "自分", icon: "me" },
] as const;

export const DESKTOP_NAV = [
  { href: "/", label: "今日", icon: "today" },
  { href: "/projects", label: "現場", icon: "site" },
  { href: "/photos", label: "写真", icon: "photo" },
  { href: "/reports", label: "日報", icon: "report" },
  { href: "/confirm", label: "確認", icon: "check" },
  { href: "/strategist", label: "軍師", icon: "ai" },
  { href: "/knowledge", label: "資料", icon: "docs" },
  { href: "/settings", label: "会社", icon: "org" },
  { href: "/account", label: "自分", icon: "me" },
] as const;

type IconName = (typeof DESKTOP_NAV)[number]["icon"];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavIcon({ name, className }: { name: IconName; className?: string }) {
  const common = className ?? "h-5 w-5";
  switch (name) {
    case "today":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <rect x="3.5" y="5" width="17" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3.5v3M16 3.5v3M3.5 10h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "site":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path
            d="M4 20V9.5L12 4l8 5.5V20"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M10 20v-6h4v6" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "photo":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <rect x="3.5" y="6.5" width="17" height="13" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 6.5l1.4-2h5.2L16 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "ai":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path
            d="M12 3.5l1.2 5.2L18.5 10 13.2 11.3 12 16.5l-1.2-5.2L5.5 10l5.3-1.3L12 3.5z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8.2 12.2l2.4 2.4 5.2-5.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "me":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <circle cx="12" cy="8.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5.5 19c1.2-3.2 3.5-4.8 6.5-4.8s5.3 1.6 6.5 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "report":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path d="M7 3.5h7.5L19 8v12.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M14.5 3.8V8H19M8.5 12.5h7M8.5 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "docs":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path d="M8 5.5h10.5v14H8A2.5 2.5 0 0 1 5.5 17V8A2.5 2.5 0 0 1 8 5.5z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9.5 9.5h7M9.5 13h7M9.5 16.5h4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "org":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path d="M4.5 20V10.5h6V20M10.5 20V6.5h9V20M4.5 20h15" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M7 13.5h1M7 16.5h1M13.5 9.5h2M13.5 13h2M13.5 16.5h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function LinkBusy({
  children,
  stacked = false,
}: {
  children: ReactNode;
  stacked?: boolean;
}) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={`flex items-center justify-center transition-opacity duration-150 ${
        stacked ? "flex-col gap-0.5" : "gap-2"
      } ${pending ? "opacity-50" : "opacity-100"}`}
    >
      {pending && !stacked ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : null}
      {children}
    </span>
  );
}

export function AppLink({
  href,
  children,
  className,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const styles =
    variant === "primary"
      ? "bg-[var(--kb-ink)] text-white shadow-sm hover:bg-zinc-800"
      : variant === "secondary"
        ? "border border-[var(--kb-line)] bg-white text-[var(--kb-ink)] hover:bg-zinc-50"
        : "text-zinc-500 hover:text-zinc-900";
  return (
    <Link
      href={href}
      prefetch
      className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-4 text-base font-medium transition-all duration-150 active:scale-[0.98] ${styles} ${className ?? ""}`}
    >
      <LinkBusy>{children}</LinkBusy>
    </Link>
  );
}

function DesktopItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
        active ? "bg-[var(--kb-ink)] text-white shadow-sm" : "text-zinc-600 hover:bg-white/80 hover:text-zinc-900"
      }`}
    >
      <LinkBusy>
        <NavIcon name={icon} className="h-4 w-4" />
        <span>{label}</span>
      </LinkBusy>
    </Link>
  );
}

function MobileItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 pt-1 text-[11px] font-medium transition-colors duration-150 ${
        active ? "text-[var(--kb-ink)]" : "text-zinc-400"
      }`}
    >
      {active ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-[var(--kb-ink)]" /> : null}
      <LinkBusy stacked>
        <NavIcon name={icon} className={`h-[18px] w-[18px] ${active ? "text-[var(--kb-ink)]" : ""}`} />
        <span>{label}</span>
      </LinkBusy>
    </Link>
  );
}

export function AppNav({ orgSwitcher }: { orgSwitcher: ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <header className="mb-8 hidden items-center justify-between gap-4 md:flex">
        <Link href="/" prefetch className="shrink-0 text-lg font-semibold tracking-tight">
          KENBEI
        </Link>
        <nav className="flex flex-1 flex-wrap items-center justify-center gap-1 rounded-full bg-white/70 p-1 ring-1 ring-[var(--kb-line)] backdrop-blur">
          {DESKTOP_NAV.map((item) => (
            <DesktopItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isActivePath(pathname, item.href)}
            />
          ))}
        </nav>
        <div className="shrink-0">{orgSwitcher}</div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--kb-line)] bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(15,23,42,0.06)] backdrop-blur-md md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {MOBILE_NAV.map((item) => (
            <MobileItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isActivePath(pathname, item.href)}
            />
          ))}
        </div>
      </nav>
    </>
  );
}
