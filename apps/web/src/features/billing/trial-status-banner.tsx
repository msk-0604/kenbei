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
      <p className="mb-4 flex flex-wrap items-center gap-x-2 text-sm text-zinc-500" data-testid="trial-remaining">
        <span>無料体験 残り{daysRemaining}日</span>
        {canManageBilling ? (
          <a href="/settings/billing" className="font-medium text-[var(--kb-amber)] underline-offset-2 hover:underline">
            続けるなら月額9,800円
          </a>
        ) : null}
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
        写真・日報はそのまま残っています。月額9,800円（税込）のご契約で、すぐに続きから使えます。
      </p>
      {canManageBilling ? (
        <a
          href="/settings/billing"
          className="mt-4 inline-flex min-h-11 items-center rounded-2xl bg-[var(--kb-ink)] px-4 text-sm font-medium text-white"
        >
          月額9,800円で続ける
        </a>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">管理者による契約手続きをお待ちください</p>
      )}
    </section>
  );
}
