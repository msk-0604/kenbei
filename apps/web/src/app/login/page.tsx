import { ClipboardList } from "lucide-react";
import { LoginChooser } from "@/features/auth/login-chooser";
import { safeAuthNextPath } from "@kensapo/domain";
import { isSupabaseConfigured } from "@/lib/env";
import { isValidLoginCode, normalizeLoginCode } from "@/lib/passcode";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string; company?: string; signedout?: string; confirmed?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeAuthNextPath(params.next) || undefined;
  const isAdmin = params.mode === "admin";
  const company = normalizeLoginCode(params.company ?? "");

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-900 shadow-lg">
            <ClipboardList className="h-7 w-7 text-white" aria-hidden />
          </div>
          <h1 className="brand-wordmark text-2xl text-navy-950">KENBEI</h1>
          <p className="mt-2 text-lg text-gray-600">
            {isAdmin ? "管理者の合言葉でログインしてください。" : "メールアドレスとパスワードでログインしてください。"}
          </p>
        </div>

        {params.confirmed === "1" ? (
          <p role="status" className="mb-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-lg text-emerald-900">
            メールアドレスの確認ができました。登録したメールアドレスとパスワードでログインしてください。
          </p>
        ) : null}

        {isSupabaseConfigured() ? (
          <LoginChooser
            isAdmin={isAdmin}
            initialLoginCode={isValidLoginCode(company) ? company : ""}
            nextPath={nextPath}
            signedOut={params.signedout === "1"}
          />
        ) : (
          <p className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-lg text-amber-900">
            Supabase の環境変数がまだありません。`.env.example` を `apps/web/.env.local` にコピーし、URL と anon key
            を入れてください。
          </p>
        )}
      </div>
    </div>
  );
}
