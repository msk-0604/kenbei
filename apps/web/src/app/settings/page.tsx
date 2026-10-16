import { ActionLink } from "@/components/ui/action-link";
import { Card } from "@/components/ui/card";
import { NotificationSettings } from "@/features/settings/notification-settings";
import { PasscodeSettings } from "@/features/settings/passcode-settings";
import { ChangeDeviceNameButton, LogoutButton } from "@/features/settings/settings-extras";
import { DisplayNameForm } from "@/features/profile/display-name-form";
import { can, isCrewLogin, isSiteAdmin, requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const workspace = await requireWorkspace();
  const isAdmin = isSiteAdmin(workspace);
  const isCrew = isCrewLogin(workspace);
  const canManageCompany = can(workspace, "org.manage") || can(workspace, "member.manage");

  return (
    <>
      <section className="mb-8">
        <h1 className="text-[1.875rem] font-bold leading-tight text-navy-950">設定</h1>
        <p className="mt-2 text-lg leading-relaxed text-gray-600">アカウントの確認・変更</p>
      </section>

      {isAdmin ? (
        <section className="mb-8 space-y-4">
          <ActionLink href="/kanri" description="現場・予定・従業員の登録">
            管理画面
          </ActionLink>
        </section>
      ) : null}

      <section className="space-y-4">
        <ActionLink href="/notices" variant="secondary" description="新しい現場・予定・工程の変更">
          お知らせを見る
        </ActionLink>

        <NotificationSettings />

        {isCrew ? (
          <Card>
            <h2 className="mb-3 text-base font-bold text-gray-600">この端末の名前</h2>
            <p className="mb-4 text-base text-gray-600">
              「自分の予定」は、この端末で選んだ名前で表示しています。別の人がこの端末を使うときは選び直してください。
            </p>
            <ChangeDeviceNameButton />
          </Card>
        ) : (
          <Card>
            <h2 className="mb-3 text-base font-bold text-gray-600">お名前（日報の記入者・作業の記録）</h2>
            <DisplayNameForm defaultName={workspace.displayName} compact />
          </Card>
        )}

        {isAdmin ? (
          <>
            <PasscodeSettings kind="admin" />
            <PasscodeSettings kind="worker" />
          </>
        ) : null}

        <Card>
          <h2 className="mb-3 text-base font-bold text-gray-600">会社情報</h2>
          <dl className="space-y-2 text-lg">
            <div>
              <dt className="text-gray-500">会社名</dt>
              <dd className="font-medium text-navy-950">{workspace.organizationName}</dd>
            </div>
          </dl>
        </Card>

        {canManageCompany ? (
          <ActionLink href="/settings/members" variant="secondary" description="招待・権限・会社のロゴ・ご契約">
            メンバーと会社の設定
          </ActionLink>
        ) : null}

        {isCrew ? (
          <ActionLink href="/login?mode=admin" description="管理者の合言葉を入れると切り替わります">
            管理者としてログインする
          </ActionLink>
        ) : null}

        <LogoutButton />
      </section>
    </>
  );
}
