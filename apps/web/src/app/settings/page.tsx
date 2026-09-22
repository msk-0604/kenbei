import { AppShell } from "@/components/app-shell";
import { PlanBillingPanel } from "@/features/billing/plan-billing-panel";
import { CompanySettingsForm, CopyInviteLinkButton, InviteMemberForm, MembershipStatusForm } from "@/features/settings/forms";
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
  const canInvite = can(workspace, "member.manage");
  const [settings, invites, members, entitlement] = await Promise.all([
    getCompanySettings(workspace.organizationId),
    canInvite ? listInvites() : Promise.resolve([]),
    canInvite ? listOrganizationMembers() : Promise.resolve([]),
    can(workspace, "org.manage")
      ? getEntitlement(workspace.organizationId)
      : Promise.resolve(null),
  ]);
  const pendingInvites = invites.filter((invite) => !invite.acceptedAt);
  const activeMembers = members.filter((member) => member.status === "active");
  const stoppedMembers = members.filter((member) => member.status === "disabled");

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
      {canInvite ? (
        <section className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
          <h2 className="mb-3 text-base font-medium">メンバー招待</h2>
          <InviteMemberForm organizationName={settings.organizationName} />
        </section>
      ) : null}
      {canInvite ? (
        <section className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
          <h2 className="mb-3 text-base font-medium">メンバー {activeMembers.length}人</h2>
          <ul className="flex flex-col gap-2">
            {activeMembers.map((member) => (
              <li key={member.membershipId} className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm">
                <p className="font-medium">{member.displayName}</p>
                <p className="text-zinc-500">
                  {member.roleName} / 所属中
                </p>
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
                <p className="text-zinc-500">
                  {member.roleName} / 停止
                </p>
                <MembershipStatusForm membershipId={member.membershipId} nextStatus="active" label="有効にする" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {canInvite ? (
        <section className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
          <h2 className="mb-3 text-base font-medium">招待中</h2>
          {pendingInvites.length === 0 ? (
            <p className="text-sm text-zinc-500">招待中の人はいません。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pendingInvites.map((invite) => (
                <li key={invite.id} className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm">
                  <p className="font-medium">{invite.roleName}</p>
                  <p className="text-zinc-500">有効期限 {invite.expiresAt.slice(0, 10)}</p>
                  <CopyInviteLinkButton url={`${getAppUrl()}/join?token=${invite.token}`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      <nav className="mt-8 flex flex-col gap-3">
        <a href="/settings/data" className="rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-100">
          データを保存
        </a>
      </nav>
    </AppShell>
  );
}
