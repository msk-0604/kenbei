import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SignInForm } from "@/features/auth/sign-in-form";
import { safeAuthNextPath } from "@kensapo/domain";
import { isSupabaseConfigured } from "@/lib/env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeAuthNextPath(params.next) || undefined;

  if (!isSupabaseConfigured()) {
    return (
      <AuthShell title="設定が必要です" description="Supabase の環境変数がまだありません。">
        <p className="text-sm text-zinc-600">
          `.env.example` を `apps/web/.env.local` にコピーし、URL と anon key を入れてください。
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="ログイン" description="現場の記録から、今日の事務まで。写真・作業・日報をつなげます。">
      <SignInForm nextPath={nextPath} />
      <p className="mt-4 text-sm text-zinc-600">
        <Link href="/forgot-password" className="underline">
          パスワードを忘れた
        </Link>
      </p>
      <p className="mt-6 text-sm text-zinc-600">
        初めての方は{" "}
        <Link
          href={nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup"}
          className="inline-flex items-center font-medium text-zinc-900 underline"
        >
          アカウント作成
        </Link>
      </p>
    </AuthShell>
  );
}
