import { ClipboardList } from "lucide-react";
import { LoginChooser } from "@/features/auth/login-chooser";
import { safeAuthNextPath } from "@kensapo/domain";
import { isSupabaseConfigured } from "@/lib/env";
import { isValidLoginCode, normalizeLoginCode } from "@/lib/passcode";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string; company?: string }>;
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
            {isAdmin ? "管理者の合言葉でログインしてください。" : "会社の合言葉か、メールアドレスでログインしてください。"}
          </p>
        </div>

        {isSupabaseConfigured() ? (
          <LoginChooser
            isAdmin={isAdmin}
            initialLoginCode={isValidLoginCode(company) ? company : ""}
            nextPath={nextPath}
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
