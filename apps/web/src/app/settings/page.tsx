import { AppShell } from "@/components/app-shell";
import { CompanySettingsForm, InviteMemberForm } from "@/features/settings/forms";
import { getCompanySettings, listInvites } from "@/features/settings/queries";
import { getAppUrl } from "@/lib/env";
import { can, requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const workspace = await requireWorkspace();
  const canManage = can(workspace, "org.manage") || can(workspace, "member.manage");
  if (!canManage) {
    return (
      <AppShell>
        <h1 className="text-3xl font-semibold tracking-tight">会社</h1>
        <p className="mt-3 text-zinc-600">会社設定を変更する権限がありません。</p>
      </AppShell>
    );
  }
  const [settings, invites] = await Promise.all([
    getCompanySettings(workspace.organizationId),
    listInvites(),
  ]);

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">会社設定</h1>
      <p className="mt-2 text-base text-zinc-600">KENBEI を御社の道具として使えるようにします。</p>
      <section className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
        <h2 className="mb-3 text-base font-medium">表示名とロゴ</h2>
        <CompanySettingsForm
          companyDisplayName={settings.companyDisplayName}
          organizationName={settings.organizationName}
          logoUrl={settings.logoUrl}
        />
      </section>
      <section className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
        <h2 className="mb-3 text-base font-medium">メンバー招待</h2>
        <p className="mb-4 text-sm text-zinc-500">
          招待リンクを送り、同じメールでサインアップ／サインインしてもらいます。
        </p>
        <InviteMemberForm />
        <ul className="mt-6 flex flex-col gap-2">
          {invites.map((invite) => (
            <li key={invite.id} className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm">
              <p className="font-medium">{invite.email}</p>
              <p className="text-zinc-500">
                {invite.roleName} / {invite.acceptedAt ? "参加済み" : `有効期限 ${invite.expiresAt.slice(0, 10)}`}
              </p>
              {!invite.acceptedAt ? (
                <p className="mt-1 break-all text-xs text-zinc-400">{`${getAppUrl()}/join?token=${invite.token}`}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <nav className="mt-8 flex flex-col gap-3">
        <a href="/settings/data" className="rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-100">
          データエクスポート
        </a>
        {can(workspace, "org.manage") ? (
          <a href="/settings/billing" className="rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-100">
            お支払い
          </a>
        ) : null}
      </nav>
    </AppShell>
  );
}
