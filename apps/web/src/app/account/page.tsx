import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { listUnreadNotifications } from "@/lib/notifications";
import { requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

const ROLE_MAP: Record<string, string> = {
  owner: "OWNER",
  executive: "ADMIN",
  manager: "ADMIN",
  supervisor: "MANAGER",
  worker: "MEMBER",
  office: "ADMIN",
  partner: "協力会社（将来）",
  guest: "ゲスト",
};

export default async function AccountPage() {
  const workspace = await requireWorkspace();
  const notifications = await listUnreadNotifications(workspace);

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">自分</h1>
      <p className="mt-3 text-base text-zinc-600">{workspace.displayName}</p>
      <p className="text-base text-zinc-600">{workspace.organizationName}</p>
      <p className="mt-1 text-sm text-zinc-500">
        {ROLE_MAP[workspace.roleCode] ?? workspace.roleName} / {workspace.roleName}
      </p>
      <nav className="mt-8 flex flex-col gap-3">
        <Link href="/settings" className="rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-100">
          会社設定
        </Link>
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
