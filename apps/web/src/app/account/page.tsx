import Link from "next/link";
import { accountAdminLinks, memberFacingRoleLabel, type BillingAccessKind } from "@kensapo/domain";
import { AppShell } from "@/components/app-shell";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { DisplayNameForm } from "@/features/profile/display-name-form";
import { listUnreadNotifications } from "@/lib/notifications";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { getEntitlement } from "@/lib/entitlement";
import { KENBEI_PRICE_LABEL, KENBEI_PRICE_NOTE } from "@/features/billing/plan-copy";

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

function BillingCard({ access, trialDaysLeft }: { access: BillingAccessKind; trialDaysLeft: number | null }) {
  if (access === "paid_active") {
    return (
      <Link
        href="/settings/billing"
        className="kb-tap flex min-h-14 items-center justify-between gap-3 rounded-3xl bg-white px-5 py-3 ring-1 ring-[var(--kb-line)]"
      >
        <span>
          <span className="block font-medium">ご契約中（{KENBEI_PRICE_LABEL}）</span>
          <span className="block text-sm text-zinc-500">お支払い・領収書・解約</span>
        </span>
        <span aria-hidden className="text-zinc-400">
          ›
        </span>
      </Link>
    );
  }
  const lead =
    access === "trial_active"
      ? `無料体験 残り${trialDaysLeft ?? 0}日`
      : access === "trial_expired"
        ? "無料体験が終了しました"
        : access === "grandfathered_free"
          ? "いまは無料でご利用中です"
          : "ご契約が無効です";
  return (
    <Link href="/settings/billing" className="kb-tap kb-elev block rounded-3xl bg-[var(--kb-ink)] p-5 text-white">
      <span className="block text-sm text-sky-300">{lead}</span>
      <span className="mt-1 block text-2xl font-semibold tracking-tight">{KENBEI_PRICE_LABEL}で続ける</span>
      <span className="mt-1 block text-sm text-white/70">{KENBEI_PRICE_NOTE}</span>
      <span className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-[var(--kb-accent)] font-medium">
        契約する →
      </span>
    </Link>
  );
}

export default async function AccountPage() {
  const workspace = await requireWorkspace();
  const links = accountAdminLinks({
    orgManage: can(workspace, "org.manage"),
    memberManage: can(workspace, "member.manage"),
  });
  const [notifications, entitlement] = await Promise.all([
    listUnreadNotifications(workspace),
    links.billing ? getEntitlement(workspace.organizationId) : Promise.resolve(null),
  ]);

  const daily: MenuItem[] = [
    { href: "/photos", label: "写真一覧", note: "現場ごとに探す・整理する" },
    { href: "/tasks", label: "タスク", note: "全現場の残作業" },
    {
      href: "/confirm",
      label: "確認待ち",
      note: "日報・写真・音声報告の確認",
      badge: notifications.length,
    },
    { href: "/capture", label: "音声で報告", note: "話すだけで記録" },
  ];
  const admin: MenuItem[] = [
    ...(links.memberManage ? [{ href: "/settings", label: "メンバー管理", note: "招待・権限・会社のロゴ" }] : []),
    ...(links.dataExport ? [{ href: "/settings/data", label: "データを保存", note: "まとめてダウンロード" }] : []),
  ];

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">メニュー</h1>
      <p className="mt-2 text-sm text-zinc-500">
        {workspace.displayName} · {workspace.organizationName} ·{" "}
        {memberFacingRoleLabel(workspace.roleCode) || workspace.roleName}
      </p>
      <div className="mt-6 flex flex-col gap-6">
        <section>
          <h2 className="text-sm font-medium text-zinc-500">お名前（日報の記入者）</h2>
          <div className="mt-2">
            <DisplayNameForm defaultName={workspace.displayName} compact />
          </div>
        </section>
        {entitlement ? (
          <BillingCard access={entitlement.access} trialDaysLeft={entitlement.trialDaysLeft} />
        ) : null}
        <MenuGroup title="毎日使う" items={daily} />
        <MenuGroup title="会社の管理" items={admin} />
      </div>
      <div className="mt-10">
        <SignOutButton />
      </div>
    </AppShell>
  );
}
