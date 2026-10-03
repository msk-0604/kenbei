"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Bottom bar: the 4 places a site manager goes every day, plus a big camera button in the middle. */
export const MOBILE_NAV = [
  { href: "/", label: "今日", icon: "today" },
  { href: "/projects", label: "現場", icon: "site" },
  { href: "/photos/upload", label: "撮る", icon: "photo", primary: true },
  { href: "/reports", label: "日報", icon: "report" },
  { href: "/account", label: "メニュー", icon: "menu" },
] as const;

export const DESKTOP_NAV = [
  { href: "/", label: "今日", icon: "today" },
  { href: "/projects", label: "現場", icon: "site" },
  { href: "/photos", label: "写真", icon: "photo" },
  { href: "/tasks", label: "タスク", icon: "check" },
  { href: "/reports", label: "日報", icon: "report" },
  { href: "/account", label: "メニュー", icon: "menu" },
] as const;

/** Pages reached from メニュー; keep the メニュー tab lit while on them. */
const MENU_PATHS = ["/account", "/settings", "/strategist", "/knowledge", "/confirm", "/capture"];

type IconName = (typeof DESKTOP_NAV)[number]["icon"];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  if (href === "/account") {
    return MENU_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  }
  if (href === "/photos") {
    return pathname === "/photos" || (pathname.startsWith("/photos/") && !pathname.startsWith("/photos/upload"));
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
    case "menu":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path d="M4.5 7h15M4.5 12h15M4.5 17h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8.2 12.2l2.4 2.4 5.2-5.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "report":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path d="M7 3.5h7.5L19 8v12.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M14.5 3.8V8H19M8.5 12.5h7M8.5 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
      className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-4 text-base font-medium kb-tap ${styles} ${className ?? ""}`}
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
      className={`kb-tap inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium ${
        active ? "bg-[var(--kb-ink)] text-white" : "text-zinc-600 hover:bg-white/80 hover:text-zinc-900"
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
  primary = false,
}: {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
  primary?: boolean;
}) {
  if (primary) {
    return (
      <Link
        href={href}
        prefetch
        aria-current={active ? "page" : undefined}
        className="kb-tap relative flex min-h-14 flex-col items-center justify-end gap-0.5 px-1 pb-1 text-xs font-semibold text-[var(--kb-ink)]"
      >
        <LinkBusy stacked>
          <span className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--kb-amber)] text-white shadow-lg ring-4 ring-white">
            <NavIcon name={icon} className="h-6 w-6" />
          </span>
          <span>{label}</span>
        </LinkBusy>
      </Link>
    );
  }
  return (
    <Link
      href={href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={`kb-tap relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 pt-1 text-xs font-medium ${
        active ? "text-[var(--kb-ink)]" : "text-zinc-400"
      }`}
    >
      {active ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-[var(--kb-ink)]" /> : null}
      <LinkBusy stacked>
        <NavIcon name={icon} className={`h-5 w-5 ${active ? "text-[var(--kb-ink)]" : ""}`} />
        <span>{label}</span>
      </LinkBusy>
    </Link>
  );
}

export function AppNav({
  orgSwitcher,
}: {
  orgSwitcher: ReactNode;
  canOpenSettings?: boolean;
}) {
  const pathname = usePathname();
  return (
    <>
      <header className="mb-5 flex items-center justify-between gap-3 md:hidden">
        <Link href="/" prefetch className="inline-flex shrink-0 items-center" aria-label="KENBEI">
          <img src="/logo-k.png" alt="KENBEI" width={28} height={28} className="h-7 w-7 object-contain" />
        </Link>
        <div className="min-w-0">{orgSwitcher}</div>
      </header>
      <header className="mb-8 hidden items-center justify-between gap-4 md:flex">
        <Link href="/" prefetch className="inline-flex shrink-0 items-center" aria-label="KENBEI">
          <img src="/logo-k.png" alt="KENBEI" width={28} height={28} className="h-7 w-7 object-contain" />
        </Link>
        <nav className="flex flex-1 flex-wrap items-center justify-center gap-1 rounded-full bg-white p-1 ring-1 ring-[var(--kb-line)]">
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
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/photos/upload"
            prefetch
            className="kb-tap inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--kb-amber)] px-4 text-sm font-semibold text-white"
          >
            <NavIcon name="photo" className="h-4 w-4" />
            写真を撮る
          </Link>
          {orgSwitcher}
        </div>
      </header>
      <nav
        aria-label="メインメニュー"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--kb-line)] bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE_NAV.map((item) => (
            <MobileItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              primary={"primary" in item && item.primary}
              active={isActivePath(pathname, item.href)}
            />
          ))}
        </div>
      </nav>
    </>
  );
}
