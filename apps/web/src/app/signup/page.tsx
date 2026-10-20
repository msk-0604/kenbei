import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/features/auth/sign-up-form";
import { KENBEI_MONTHLY_PRICE_JPY, safeAuthNextPath } from "@kensapo/domain";
import { isSupabaseConfigured } from "@/lib/env";

const SIGNUP_PROMISES = [
  "14日間無料・カードの登録なし",
  "無料期間のあと、自動で課金されません",
  `続けるなら会社ごと月額${KENBEI_MONTHLY_PRICE_JPY.toLocaleString("ja-JP")}円（税込）`,
];

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeAuthNextPath(params.next) || undefined;

  if (!isSupabaseConfigured()) {
    return (
      <AuthShell title="設定が必要です" description="Supabase の環境変数がまだありません。">
        <p className="text-sm text-zinc-600">先に `.env.local` を設定してください。</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="アカウント作成" description="メールとパスワードだけです。会社名は次の画面で聞きます。">
      <ul className="mb-5 space-y-1 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
        {SIGNUP_PROMISES.map((line) => (
          <li key={line}>✓ {line}</li>
        ))}
      </ul>
      <SignUpForm nextPath={nextPath} />
      <p className="mt-6 text-sm text-zinc-600">
        すでにアカウントがある方は{" "}
        <Link
          href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"}
          className="font-medium text-zinc-900 underline"
        >
          ログイン
        </Link>
      </p>
    </AuthShell>
  );
}
