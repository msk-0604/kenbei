import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { AcceptInviteButton } from "@/features/settings/accept-invite-button";
import { getWorkspace, hasOrganization } from "@/lib/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";
  const workspace = await getWorkspace();

  if (!token) {
    return (
      <AuthShell title="招待リンクが必要です" description="会社の管理者から送られたリンクを開いてください。">
        <Link href="/login" className="font-medium underline">
          サインイン
        </Link>
      </AuthShell>
    );
  }

  if (!workspace) {
    return (
      <AuthShell title="招待を受け取る" description="同じメールアドレスでサインインすると、会社に参加できます。">
        <Link
          href={`/login?next=${encodeURIComponent(`/join?token=${token}`)}`}
          className="flex items-center justify-center rounded-2xl bg-[var(--kb-ink)] font-medium text-white"
        >
          サインインして参加
        </Link>
        <p className="mt-4 text-sm text-zinc-600">
          アカウントがない場合は{" "}
          <Link href={`/signup?next=${encodeURIComponent(`/join?token=${token}`)}`} className="underline">
            作成
          </Link>
        </p>
      </AuthShell>
    );
  }

  const supabase = await createServerSupabaseClient();
  const invite = await supabase
    .from("organization_invitations")
    .select("email, expires_at, accepted_at")
    .eq("token", token)
    .is("deleted_at", null)
    .maybeSingle();
  const row = invite.data as
    | {
        email: string;
        expires_at: string;
        accepted_at: string | null;
      }
    | null;

  if (!row || row.accepted_at) {
    return (
      <AuthShell title="招待を確認できません" description="リンクが無効か、すでに参加済みです。">
        <Link href="/" className="font-medium underline">
          今日へ
        </Link>
      </AuthShell>
    );
  }

  if (hasOrganization(workspace) && workspace.organizationName) {
    return (
      <AuthShell
        title="すでに会社に所属しています"
        description={`${workspace.organizationName} に参加中です。別会社へ移る場合は管理者に相談してください。`}
      >
        <Link href="/" className="font-medium underline">
          今日へ
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="会社へ参加" description={`${row.email} 宛の招待です。`}>
      <AcceptInviteButton token={token} />
    </AuthShell>
  );
}
