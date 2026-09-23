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
      description="確認リンクを開くと、ログインし直さずに会社へ参加し、今日の画面に進みます。"
    >
      <p className="text-sm leading-6 text-zinc-600">
        メールが届かない場合のみ、
        <Link href={loginHref} className="font-medium underline">
          ログイン
        </Link>
        から復旧できます。
      </p>
    </AuthShell>
  );
}
