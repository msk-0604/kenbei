import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/features/auth/sign-up-form";
import { isSupabaseConfigured } from "@/lib/env";

export default function SignUpPage() {
  if (!isSupabaseConfigured()) {
    return (
      <AuthShell title="設定が必要です" description="Supabase の環境変数がまだありません。">
        <p className="text-sm text-zinc-600">先に `.env.local` を設定してください。</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="アカウント作成" description="メールとパスワードだけです。会社名は次の画面で聞きます。">
      <SignUpForm />
      <p className="mt-6 text-sm text-zinc-600">
        すでにアカウントがある方は{" "}
        <Link href="/login" className="font-medium text-zinc-900 underline">
          サインイン
        </Link>
      </p>
    </AuthShell>
  );
}
