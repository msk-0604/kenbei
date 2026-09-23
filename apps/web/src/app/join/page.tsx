import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { AcceptInviteButton } from "@/features/settings/accept-invite-button";
import { JoinSignupForm } from "@/features/settings/join-signup-form";
import { signOutToJoinAction } from "@/features/settings/join-actions";
import { firstInvitePreview } from "@/features/settings/invite-preview";
import {
  alreadyInCompanyMessage,
  inviteEmailMismatchMessage,
  inviteJoinPath,
  inviteJoinSignupHint,
  normalizeInviteEmail,
} from "@kensapo/domain";
import { getWorkspace, hasOrganization } from "@/lib/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; grant?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";
  const grant = params.grant ?? "";
  const hasGrant = /^[a-f0-9]{64}$/i.test(grant);
  const workspace = await getWorkspace();

  if (!token) {
    return (
      <AuthShell title="招待リンクが必要です" description="会社の管理者から送られたリンクを開いてください。">
        <Link href="/login" className="font-medium underline">
          ログイン
        </Link>
      </AuthShell>
    );
  }

  const supabase = await createServerSupabaseClient();
  const preview = await supabase.rpc("preview_organization_invite", { p_token: token });
  const row = firstInvitePreview(preview.data);
  const companyName = row?.company_name || "会社";
  const roleLabel = row?.role_label;
  const state = row?.invite_state ?? "not_found";
  const invitedEmail = normalizeInviteEmail(row?.invited_email);
  const next = inviteJoinPath(token);

  if (state === "not_found") {
    return (
      <AuthShell title="招待を確認できません" description="リンクが無効です。">
        <Link href="/" className="font-medium underline">
          今日へ
        </Link>
      </AuthShell>
    );
  }

  if (state === "used") {
    return (
      <AuthShell title="この招待リンクは使われています" description={`${companyName} の招待は、すでに参加済みです。`}>
        <Link href="/" className="font-medium underline">
          今日へ
        </Link>
      </AuthShell>
    );
  }

  if (state === "expired") {
    return (
      <AuthShell title="招待の期限が切れています" description={`${companyName} の管理者に、新しい招待リンクをもらってください。`}>
        <Link href="/" className="font-medium underline">
          今日へ
        </Link>
      </AuthShell>
    );
  }

  if (workspace && hasOrganization(workspace)) {
    return (
      <AuthShell title="すでに会社に所属しています" description={alreadyInCompanyMessage(workspace.organizationName || "今の会社")}>
        <Link href="/" className="font-medium underline">
          今日へ
        </Link>
      </AuthShell>
    );
  }

  if (row?.email_state === "mismatch") {
    return (
      <AuthShell title="招待を確認できません" description={inviteEmailMismatchMessage()}>
        {invitedEmail ? <p className="mb-4 text-sm leading-6 text-zinc-600">招待先：{invitedEmail}</p> : null}
        <div className="flex flex-col gap-3">
          <form action={signOutToJoinAction}>
            <input type="hidden" name="token" value={token} />
            {hasGrant ? <input type="hidden" name="grant" value={grant} /> : null}
            <button type="submit" className="w-full rounded-2xl bg-[var(--kb-ink)] font-medium text-white">
              招待されたメールで参加
            </button>
          </form>
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white font-medium"
          >
            別のアカウントでログイン
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (!workspace) {
    return (
      <AuthShell title={`${companyName}から招待されています`} description={roleLabel ? `権限：${roleLabel}` : "この会社に参加できます。"}>
        <p className="text-sm leading-6 text-zinc-600">
          {inviteJoinSignupHint(companyName, hasGrant ? "grant" : "confirm")}
        </p>
        <div className="mt-6">
          <JoinSignupForm
            token={token}
            grant={hasGrant ? grant : undefined}
            invitedEmail={invitedEmail ?? undefined}
            emailLocked={Boolean(invitedEmail)}
          />
        </div>
        <p className="mt-6 text-sm text-zinc-600">
          すでにアカウントがある方は{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium underline">
            ログインして参加
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={`${companyName}から招待されています`} description={roleLabel ? `権限：${roleLabel}` : "この会社に参加できます。"}>
      <p className="text-sm leading-6 text-zinc-600">
        この会社に参加すると、{companyName} の現場・写真・作業・日報を利用できます。
      </p>
      <div className="mt-6">
        <AcceptInviteButton token={token} companyName={companyName} />
      </div>
    </AuthShell>
  );
}
