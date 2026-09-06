import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="パスワード再設定" description="登録メールにリセット用のリンクを送ります。">
      <ForgotPasswordForm />
      <p className="mt-6 text-sm text-zinc-600">
        <Link href="/login" className="underline">
          サインインへ戻る
        </Link>
      </p>
    </AuthShell>
  );
}
