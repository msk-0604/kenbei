import type { BillingAccessKind } from "@kensapo/domain";

export function TrialStatusBanner({
  access,
  daysRemaining,
  canManageBilling,
}: {
  access: BillingAccessKind;
  daysRemaining: number | null;
  canManageBilling: boolean;
}) {
  if (access === "trial_active" && daysRemaining != null) {
    return (
      <p className="mb-4 text-sm text-zinc-500" data-testid="trial-remaining">
        無料体験 残り{daysRemaining}日
      </p>
    );
  }

  if (access !== "trial_expired" && access !== "paid_inactive") {
    return null;
  }

  const expiredTrial = access === "trial_expired";
  return (
    <section
      className="mb-5 rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200"
      data-testid="trial-expired-banner"
    >
      <h2 className="text-lg font-semibold tracking-tight">
        {expiredTrial ? "14日間の無料体験が終了しました" : "ご契約が無効です"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-700">
        引き続きKENBEIをご利用いただくには、STANDARDまたはBUSINESSをご契約ください。
      </p>
      {canManageBilling ? (
        <a
          href="/settings/billing"
          className="mt-4 inline-flex min-h-11 items-center rounded-2xl bg-[var(--kb-ink)] px-4 text-sm font-medium text-white"
        >
          プランを選択
        </a>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">管理者による契約手続きをお待ちください</p>
      )}
    </section>
  );
}
