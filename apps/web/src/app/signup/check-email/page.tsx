import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export default function CheckEmailPage() {
  return (
    <AuthShell
      title="メールを確認してください"
      description="確認リンクを開くと KENBEI を使い始められます。確認メールが不要な環境では、そのままサインインできます。"
    >
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-4 text-base font-medium text-white"
      >
        サインインへ
      </Link>
    </AuthShell>
  );
}
