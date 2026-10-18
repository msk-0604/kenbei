"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Calendar, LayoutDashboard, MapPin, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { readPersonName } from "@/lib/person-name";
import { registerPushServiceWorker } from "@/lib/push/client";

/**
 * 下部ナビはあえて2つだけ（スケジュール／現場一覧）。
 * 管理者の機能は右上の「管理」（/kanri）1か所に集める。
 */
export const MOBILE_NAV = [
  { href: "/today", label: "スケジュール", Icon: Calendar },
  { href: "/sites", label: "現場一覧", Icon: MapPin },
] as const;

/** 今いる画面がどのタブの中か。予定（/schedule）はスケジュール、現場の中はすべて現場一覧。 */
export function activeNavHref(pathname: string): string | null {
  if (pathname === "/today" || pathname.startsWith("/today/") || pathname.startsWith("/schedule")) {
    return "/today";
  }
  if (pathname === "/sites" || pathname.startsWith("/sites/")) {
    return "/sites";
  }
  return null;
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
      className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-4 text-base font-medium kb-tap ${styles} ${className ?? ""}`}
    >
      <LinkBusy>{children}</LinkBusy>
    </Link>
  );
}

export function AppNav({
  orgSwitcher,
  displayName,
  companyName,
  isAdmin = false,
  usesDeviceName = false,
}: {
  orgSwitcher: ReactNode;
  displayName: string;
  companyName: string;
  isAdmin?: boolean;
  /** 共通ログインの端末は、この端末で選んだ名前を出す */
  usesDeviceName?: boolean;
}) {
  const pathname = usePathname();
  const [deviceName, setDeviceName] = useState("");
  const active = activeNavHref(pathname);

  useEffect(() => {
    if (usesDeviceName) {
      setDeviceName(readPersonName());
    }
  }, [pathname, usesDeviceName]);

  useEffect(() => {
    const run = () => {
      void registerPushServiceWorker();
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(run, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(run, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const name = usesDeviceName ? deviceName : displayName;

  return (
    <>
      <div className="sticky top-0 z-40 no-print">
        <header className="border-b-2 border-gray-200 bg-white/90 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto flex min-h-[4.5rem] max-w-lg items-center justify-between gap-3 px-5">
            <Link href="/today" className="tap-press brand-wordmark text-2xl text-navy-950">
              KENBEI
            </Link>
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 text-right leading-snug">
                <p className="truncate text-lg font-bold text-gray-900">{name || "\u00A0"}</p>
                {companyName ? <p className="truncate text-base text-gray-600">{companyName}</p> : null}
              </div>
              {isAdmin ? (
                <Link
                  href="/kanri"
                  aria-label="管理"
                  className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 text-gray-700"
                >
                  <LayoutDashboard className="h-5 w-5" aria-hidden />
                </Link>
              ) : null}
              <Link
                href="/settings"
                aria-label="設定"
                className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 text-gray-700"
              >
                <Settings className="h-5 w-5" aria-hidden />
              </Link>
            </div>
          </div>
          {orgSwitcher ? <div className="mx-auto max-w-lg px-5 pb-2">{orgSwitcher}</div> : null}
        </header>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-gray-200 bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,41,0.06)] backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/80 no-print"
        aria-label="メインメニュー"
      >
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2 px-3 pb-3 pt-3">
          {MOBILE_NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              prefetch
              data-nav-tab
              aria-current={active === href ? "page" : undefined}
              className={cn(
                "tap-press relative flex min-h-[5rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center",
                active === href ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-800 hover:bg-gray-200",
              )}
            >
              <LinkBusy stacked>
                <Icon
                  key={active === href ? "on" : "off"}
                  className={cn("h-8 w-8 shrink-0", active === href && "tab-pop")}
                  aria-hidden
                />
                <span className="text-base font-bold leading-tight">{label}</span>
              </LinkBusy>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
