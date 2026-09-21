import { AppShell } from "@/components/app-shell";
import { PlanBillingPanel } from "@/features/billing/plan-billing-panel";
import { CompanySettingsForm, InviteMemberForm, MembershipStatusForm } from "@/features/settings/forms";
import { getCompanySettings, listInvites, listOrganizationMembers } from "@/features/settings/queries";
import { getAppUrl } from "@/lib/env";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { getEntitlement } from "@/lib/entitlement";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const workspace = await requireWorkspace();
  const canManage = can(workspace, "org.manage") || can(workspace, "member.manage");
  if (!canManage) {
    return (
      <AppShell>
        <h1 className="text-3xl font-semibold tracking-tight">設定</h1>
        <p className="mt-3 text-zinc-600">設定を変更する権限がありません。</p>
      </AppShell>
    );
  }
  const [settings, invites, members, entitlement] = await Promise.all([
    getCompanySettings(workspace.organizationId),
    listInvites(),
    can(workspace, "member.manage") ? listOrganizationMembers() : Promise.resolve([]),
    can(workspace, "org.manage")
      ? getEntitlement(workspace.organizationId)
      : Promise.resolve(null),
  ]);

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">設定</h1>
      <p className="mt-2 text-base leading-7 text-zinc-600">
        会社としてKENBEIを導入する判断と、表示名・メンバーの管理ができます。
      </p>
      {entitlement ? (
        <div className="mt-6">
          <PlanBillingPanel
            planCode={entitlement.planCode}
            status={entitlement.status}
            cancelAtPeriodEnd={entitlement.cancelAtPeriodEnd}
            access={entitlement.access}
            variant="settings"
          />
        </div>
      ) : null}
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
          招待リンクを送り、同じメールでアカウント作成／ログインしてもらいます。
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
      {can(workspace, "member.manage") ? (
        <section className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
          <h2 className="mb-3 text-base font-medium">メンバー</h2>
          <p className="mb-4 text-sm text-zinc-500">無効化した人はログインしてもこの会社のデータにアクセスできません。</p>
          <ul className="flex flex-col gap-2">
            {members.map((member) => (
              <li key={member.membershipId} className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm">
                <p className="font-medium">{member.displayName}</p>
                <p className="text-zinc-500">
                  {member.roleName} / {member.status === "disabled" ? "無効" : "有効"}
                </p>
                {member.profileId === workspace.userId ? (
                  <p className="mt-1 text-xs text-zinc-400">自分自身は無効化できません。</p>
                ) : member.status === "disabled" ? (
                  <MembershipStatusForm membershipId={member.membershipId} nextStatus="active" label="有効にする" />
                ) : (
                  <MembershipStatusForm membershipId={member.membershipId} nextStatus="disabled" label="無効にする" />
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <nav className="mt-8 flex flex-col gap-3">
        <a href="/settings/data" className="rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-100">
          データエクスポート
        </a>
      </nav>
    </AppShell>
  );
}
