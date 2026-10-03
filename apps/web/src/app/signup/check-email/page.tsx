import Link from "next/link";
import {
  inviteConfirmInboxDescription,
  inviteConfirmInboxSteps,
  inviteConfirmInboxTitle,
  normalizeInviteEmail,
  safeAuthNextPath,
} from "@kensapo/domain";
import { AuthShell } from "@/components/auth-shell";
import { CheckEmailResend } from "@/features/settings/check-email-resend";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; company?: string; email?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeAuthNextPath(params.next);
  const email = normalizeInviteEmail(params.email);
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  return (
    <AuthShell
      title={inviteConfirmInboxTitle(params.company)}
      description={inviteConfirmInboxDescription({ companyName: params.company, email })}
    >
      <ol className="flex flex-col gap-2">
        {inviteConfirmInboxSteps(params.company).map((step, index) => (
          <li key={step} className="flex gap-3 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[var(--kb-line)]">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--kb-ink)] text-xs font-semibold text-white">
              {index + 1}
            </span>
            <span className="leading-6">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm leading-6 text-zinc-600">届かないときは、迷惑メールフォルダも確認してください。</p>
      <div className="mt-4">
        <CheckEmailResend email={email ?? ""} nextPath={nextPath} />
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-600">
        確認が済んでいる場合は
        <Link href={loginHref} className="mx-1 font-medium underline">
          ログイン
        </Link>
        してください。
      </p>
    </AuthShell>
  );
}
