import Link from "next/link";
import { KENBEI_PLAN_NAME, type BillingAccessKind } from "@kensapo/domain";
import { startCheckoutFormAction } from "@/features/billing/actions";
import { CheckoutSubmitButton } from "@/features/billing/checkout-submit-button";
import {
  KENBEI_INCLUDED,
  KENBEI_PRICE_LABEL,
  KENBEI_PRICE_NOTE,
  checkoutButtonLabel,
  currentPlanHeadline,
  dailyPriceLabel,
} from "@/features/billing/plan-copy";

function CheckoutForm({ label }: { label: string }) {
  return (
    <form action={startCheckoutFormAction}>
      <input type="hidden" name="planCode" value="standard" />
      <CheckoutSubmitButton label={label} />
    </form>
  );
}

export function PlanBillingPanel({
  status,
  cancelAtPeriodEnd,
  access,
  trialDaysLeft,
  variant,
}: {
  planCode: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  access: BillingAccessKind;
  trialDaysLeft?: number | null;
  variant: "settings" | "billing";
}) {
  const paid = access === "paid_active";
  const locked = access === "trial_expired" || access === "paid_inactive";
  const headline = currentPlanHeadline("", access);

  if (variant === "settings") {
    return (
      <Link
        href="/settings/billing"
        className={`kb-tap flex items-center justify-between gap-4 rounded-3xl p-5 ${
          locked ? "bg-[var(--kb-ink)] text-white" : "bg-white ring-1 ring-[var(--kb-line)]"
        }`}
      >
        <span className="min-w-0">
          <span className={`block text-sm ${locked ? "text-amber-200" : "text-zinc-500"}`}>ご契約</span>
          <span className="mt-1 block font-semibold">
            {headline}
            {access === "trial_active" && trialDaysLeft != null ? `（残り${trialDaysLeft}日）` : ""}
          </span>
          {cancelAtPeriodEnd ? <span className="mt-1 block text-sm opacity-70">期末で解約予約済み</span> : null}
        </span>
        <span className={`shrink-0 text-sm font-medium ${locked ? "text-white" : "text-[var(--kb-amber)]"}`}>
          {paid ? "確認" : "契約へ"} →
        </span>
      </Link>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-[var(--kb-line)]">
      <div className="bg-[var(--kb-ink)] p-6 text-white">
        <p className="text-sm font-medium text-amber-200">{KENBEI_PLAN_NAME}</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-4xl font-semibold tabular-nums tracking-tight">{KENBEI_PRICE_LABEL}</span>
          <span className="text-sm text-white/70">（{dailyPriceLabel()}）</span>
        </p>
        <p className="mt-2 text-sm text-white/70">{KENBEI_PRICE_NOTE}</p>
      </div>
      <div className="p-6">
        <p className="text-base font-semibold" data-testid="plan-status">
          {headline}
          {access === "trial_active" && trialDaysLeft != null ? `（残り${trialDaysLeft}日）` : ""}
          {status && status !== "active" && status !== "trialing" ? ` / ${status}` : ""}
          {cancelAtPeriodEnd ? "（期末で解約予約）" : ""}
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-sm leading-6 text-zinc-700">
          {KENBEI_INCLUDED.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="font-semibold text-[var(--kb-amber)]">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
        {paid ? null : (
          <div className="mt-6">
            <CheckoutForm label={checkoutButtonLabel(access)} />
            <p className="mt-3 text-center text-xs text-zinc-500">
              カードはこのあとの支払い画面（Stripe）で登録します。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
