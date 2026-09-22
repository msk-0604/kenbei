import { AppShell } from "@/components/app-shell";
import { PlanBillingPanel } from "@/features/billing/plan-billing-panel";
import { CompanySettingsForm, InviteMemberForm, MembershipStatusForm, PendingInvitesList } from "@/features/settings/forms";
import { activeMembershipCount } from "@kensapo/domain";
import { getCompanySettings, listInvites, listOrganizationMembers } from "@/features/settings/queries";
import { getAppUrl } from "@/lib/env";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { getEntitlement } from "@/lib/entitlement";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const workspace = await requireWorkspace();
  const canEditCompany = can(workspace, "org.manage");
  const canManageMembers = can(workspace, "member.manage");
  if (!canEditCompany && !canManageMembers) {
    return (
      <AppShell>
        <h1 className="text-3xl font-semibold tracking-tight">設定</h1>
        <p className="mt-3 text-zinc-600">設定を変更する権限がありません。</p>
      </AppShell>
    );
  }
  const [settings, invites, members, entitlement] = await Promise.all([
    getCompanySettings(workspace.organizationId),
    canManageMembers ? listInvites() : Promise.resolve([]),
    canManageMembers ? listOrganizationMembers() : Promise.resolve([]),
    canEditCompany ? getEntitlement(workspace.organizationId) : Promise.resolve(null),
  ]);
  const pendingInvites = invites.filter((invite) => !invite.acceptedAt);
  const activeMembers = members.filter((member) => member.status === "active");
  const stoppedMembers = members.filter((member) => member.status === "disabled");
  const memberCount = activeMembershipCount(members);

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">{canManageMembers ? "メンバー管理" : "設定"}</h1>
      <p className="mt-2 text-base leading-7 text-zinc-600">{settings.organizationName}</p>
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
      {canEditCompany ? (
        <section className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
          <h2 className="mb-3 text-base font-medium">表示名とロゴ</h2>
          <CompanySettingsForm
            companyDisplayName={settings.companyDisplayName}
            organizationName={settings.organizationName}
            logoUrl={settings.logoUrl}
          />
        </section>
      ) : null}
      {canManageMembers ? (
        <section className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
          <h2 className="mb-3 text-base font-medium">メンバー招待</h2>
          <InviteMemberForm organizationName={settings.organizationName} />
        </section>
      ) : null}
      {canManageMembers ? (
        <section className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
          <h2 className="mb-3 text-base font-medium">メンバー {memberCount}人</h2>
          <ul className="flex flex-col gap-2">
            {activeMembers.map((member) => (
              <li key={member.membershipId} className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm">
                <p className="font-medium">{member.displayName}</p>
                <p className="text-zinc-500">権限 {member.roleName}</p>
                <p className="text-zinc-500">状態 所属中</p>
                {member.profileId === workspace.userId ? (
                  <p className="mt-1 text-xs text-zinc-400">自分自身は無効化できません。</p>
                ) : (
                  <MembershipStatusForm membershipId={member.membershipId} nextStatus="disabled" label="無効にする" />
                )}
              </li>
            ))}
            {stoppedMembers.map((member) => (
              <li key={member.membershipId} className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm">
                <p className="font-medium">{member.displayName}</p>
                <p className="text-zinc-500">権限 {member.roleName}</p>
                <p className="text-zinc-500">状態 停止</p>
                <MembershipStatusForm membershipId={member.membershipId} nextStatus="active" label="有効にする" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {canManageMembers ? (
        <section className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
          <h2 className="mb-3 text-base font-medium">招待中</h2>
          <PendingInvitesList
            appUrl={getAppUrl()}
            invites={pendingInvites.map((invite) => ({
              id: invite.id,
              email: invite.email,
              roleName: invite.roleName,
              expiresAt: invite.expiresAt,
              token: invite.token,
            }))}
          />
        </section>
      ) : null}
      {canEditCompany ? (
        <nav className="mt-8 flex flex-col gap-3">
          <a href="/settings/data" className="rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-100">
            データを保存
          </a>
        </nav>
      ) : null}
    </AppShell>
  );
}
