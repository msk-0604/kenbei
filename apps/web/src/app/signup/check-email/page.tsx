import Link from "next/link";
import { safeAuthNextPath } from "@kensapo/domain";
import { AuthShell } from "@/components/auth-shell";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeAuthNextPath(params.next);
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  return (
    <AuthShell
      title="メールを確認してください"
      description="確認リンクを開くと、招待されていた会社の参加画面に戻ります。確認メールが不要な環境では、そのままログインできます。"
    >
      <Link
        href={loginHref}
        className="inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-4 text-base font-medium text-white"
      >
        ログインへ
      </Link>
    </AuthShell>
  );
}
