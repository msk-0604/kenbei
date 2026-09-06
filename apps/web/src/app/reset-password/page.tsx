import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { getWorkspace } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const workspace = await getWorkspace();
  if (!workspace) {
    return (
      <AuthShell title="リンクが無効です" description="メールのリンクから開き直すか、もう一度リセットを依頼してください。">
        <Link href="/forgot-password" className="underline">
          再送信
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="新しいパスワード" description="8文字以上で設定してください。">
      <ResetPasswordForm />
    </AuthShell>
  );
}
