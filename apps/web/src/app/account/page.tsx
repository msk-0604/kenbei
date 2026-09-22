import Link from "next/link";
import { accountAdminLinks, memberFacingRoleLabel } from "@kensapo/domain";
import { AppShell } from "@/components/app-shell";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { listUnreadNotifications } from "@/lib/notifications";
import { can, requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const workspace = await requireWorkspace();
  const notifications = await listUnreadNotifications(workspace);
  const links = accountAdminLinks({
    orgManage: can(workspace, "org.manage"),
    memberManage: can(workspace, "member.manage"),
  });

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">自分</h1>
      <p className="mt-3 text-base text-zinc-600">{workspace.displayName}</p>
      <p className="text-base text-zinc-600">{workspace.organizationName}</p>
      <p className="mt-1 text-sm text-zinc-500">
        {memberFacingRoleLabel(workspace.roleCode) || workspace.roleName}
      </p>
      <nav className="mt-8 flex flex-col gap-3">
        <Link href="/strategist" className="kb-tap rounded-2xl bg-white px-4 py-3 ring-1 ring-[var(--kb-line)]">
          AI軍師
        </Link>
        {links.memberManage ? (
          <Link href="/settings" className="kb-tap rounded-2xl bg-white px-4 py-3 ring-1 ring-[var(--kb-line)]">
            メンバー管理
          </Link>
        ) : null}
        {links.billing ? (
          <Link href="/settings/billing" className="kb-tap rounded-2xl bg-white px-4 py-3 ring-1 ring-[var(--kb-line)]">
            会社の導入
          </Link>
        ) : null}
        {links.dataExport ? (
          <Link href="/settings/data" className="rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-100">
            データを保存
          </Link>
        ) : null}
        <Link href="/confirm" className="rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-100">
          確認待ち {notifications.length > 0 ? `（${notifications.length}）` : ""}
        </Link>
        <Link href="/knowledge" className="rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-100">
          社内資料
        </Link>
        <Link href="/reports" className="rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-100">
          日報
        </Link>
        <Link href="/capture" className="rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-100">
          音声で報告
        </Link>
      </nav>
      <div className="mt-10">
        <SignOutButton />
      </div>
    </AppShell>
  );
}
