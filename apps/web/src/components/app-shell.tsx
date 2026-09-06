import Link from "next/link";
import type { ReactNode } from "react";
import { OrgSwitcher } from "@/features/org/org-switcher";
import { getWorkspace } from "@/lib/session";

const MOBILE_NAV = [
  { href: "/", label: "今日" },
  { href: "/projects", label: "現場" },
  { href: "/photos", label: "写真" },
  { href: "/confirm", label: "確認" },
  { href: "/account", label: "自分" },
] as const;

const DESKTOP_NAV = [
  { href: "/", label: "今日" },
  { href: "/projects", label: "現場" },
  { href: "/photos", label: "写真" },
  { href: "/reports", label: "日報" },
  { href: "/confirm", label: "確認" },
  { href: "/strategist", label: "軍師" },
  { href: "/knowledge", label: "資料" },
  { href: "/settings", label: "会社" },
  { href: "/account", label: "自分" },
] as const;

export async function AppShell({ children }: { children: ReactNode }) {
  const workspace = await getWorkspace();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
      <header className="mb-8 hidden items-center justify-between gap-6 md:flex">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          KENBEI
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {DESKTOP_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2 text-zinc-700 hover:bg-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {workspace?.organizationId ? (
          <OrgSwitcher currentId={workspace.organizationId} organizations={workspace.organizations} />
        ) : null}
      </header>
      {children}
      <nav className="fixed inset-x-0 bottom-0 border-t border-[var(--kb-line)] bg-white/95 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 text-center text-sm">
          {MOBILE_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center justify-center py-3">
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
