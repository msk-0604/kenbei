import Link from "next/link";
import { accountAdminLinks, memberFacingRoleLabel } from "@kensapo/domain";
import { AppShell } from "@/components/app-shell";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { listUnreadNotifications } from "@/lib/notifications";
import { can, requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

type MenuItem = { href: string; label: string; note: string; badge?: number };

function MenuGroup({ title, items }: { title: string; items: MenuItem[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section>
      <h2 className="text-sm font-medium text-zinc-500">{title}</h2>
      <ul className="mt-2 kb-elev overflow-hidden rounded-3xl bg-white ring-1 ring-[var(--kb-line)]">
        {items.map((item, index) => (
          <li key={item.href} className={index > 0 ? "border-t border-[var(--kb-line)]" : undefined}>
            <Link href={item.href} className="kb-tap flex min-h-14 items-center justify-between gap-3 px-5 py-3">
              <span className="min-w-0">
                <span className="block font-medium">{item.label}</span>
                <span className="block text-sm text-zinc-500">{item.note}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {item.badge ? (
                  <span className="rounded-full bg-[var(--kb-accent)] px-2 py-0.5 text-xs font-semibold text-white">
                    {item.badge}
                  </span>
                ) : null}
                <span aria-hidden className="text-zinc-400">
                  ›
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function AccountPage() {
  const workspace = await requireWorkspace();
  const notifications = await listUnreadNotifications(workspace);
  const links = accountAdminLinks({
    orgManage: can(workspace, "org.manage"),
    memberManage: can(workspace, "member.manage"),
  });

  const daily: MenuItem[] = [
    { href: "/photos", label: "写真一覧", note: "現場ごとに探す・整理する" },
    { href: "/tasks", label: "タスク", note: "全現場の残作業" },
    {
      href: "/confirm",
      label: "確認待ち",
      note: "日報・写真・音声報告の確認",
      badge: notifications.length,
    },
  ];
  const tools: MenuItem[] = [
    { href: "/capture", label: "音声で報告", note: "話すだけで記録" },
    { href: "/strategist", label: "AI軍師", note: "現場の段取りを相談" },
    { href: "/knowledge", label: "社内資料", note: "マニュアル・過去資料" },
  ];
  const admin: MenuItem[] = [
    ...(links.memberManage ? [{ href: "/settings", label: "メンバー管理", note: "招待・権限・会社のロゴ" }] : []),
    ...(links.billing ? [{ href: "/settings/billing", label: "ご契約", note: "月額9,800円・お支払い・解約" }] : []),
    ...(links.dataExport ? [{ href: "/settings/data", label: "データを保存", note: "まとめてダウンロード" }] : []),
  ];

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">メニュー</h1>
      <div className="mt-4 rounded-3xl bg-[var(--kb-card)] px-5 py-4 ring-1 ring-[var(--kb-line)]">
        <p className="font-medium">{workspace.displayName}</p>
        <p className="text-sm text-zinc-500">
          {workspace.organizationName} · {memberFacingRoleLabel(workspace.roleCode) || workspace.roleName}
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-6">
        <MenuGroup title="毎日使う" items={daily} />
        <MenuGroup title="便利な機能" items={tools} />
        <MenuGroup title="会社の管理" items={admin} />
      </div>
      <div className="mt-10">
        <SignOutButton />
      </div>
    </AppShell>
  );
}
