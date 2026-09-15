import { normalizeBillingPlanCode } from "@kensapo/domain";
import { startCheckoutFormAction } from "@/features/billing/actions";
import { CheckoutSubmitButton } from "@/features/billing/checkout-submit-button";
import {
  currentPlanHeadline,
  isFreePlan,
  monthlyPriceLabel,
  planUseLine,
  seatRangeLabel,
  standardFlatNote,
  standardScopeLine,
} from "@/features/billing/plan-copy";
import { KenbeiFlow } from "@/features/product/kenbei-flow";
import { BILLING_HEADLINE, BILLING_SUPPORT } from "@/features/product/workflow";

function PlanCheckoutForm({
  planCode,
  label,
  buttonClassName,
}: {
  planCode: "standard" | "business";
  label: string;
  buttonClassName?: string;
}) {
  return (
    <form action={startCheckoutFormAction}>
      <input type="hidden" name="planCode" value={planCode} />
      <CheckoutSubmitButton label={label} className={buttonClassName} />
    </form>
  );
}

export function PlanBillingPanel({
  planCode,
  status,
  cancelAtPeriodEnd,
  variant,
}: {
  planCode: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  variant: "settings" | "billing";
}) {
  const normalized = normalizeBillingPlanCode(planCode);
  const free = isFreePlan(planCode);
  const emphasize = variant === "settings" && free;
  const statusLabel = status === "active" ? "利用中" : status;
  const ink = emphasize ? "text-white/80" : "text-zinc-600";
  const muted = emphasize ? "text-white/70" : "text-zinc-500";

  return (
    <section
      className={
        emphasize
          ? "rounded-3xl bg-[var(--kb-ink)] p-5 text-white"
          : "rounded-3xl bg-[var(--kb-card)] p-5 ring-1 ring-[var(--kb-line)]"
      }
    >
      <p className={`text-sm font-medium ${emphasize ? "text-amber-200" : "text-[var(--kb-amber)]"}`}>会社の導入</p>
      <h2 className="mt-1 text-xl font-semibold leading-snug tracking-tight">{BILLING_HEADLINE}</h2>
      <p className={`mt-2 text-sm ${muted}`}>
        {currentPlanHeadline(planCode)}
        {status && status !== "active" ? ` / ${statusLabel}` : ""}
        {cancelAtPeriodEnd ? "（期末で解約予約）" : ""}
      </p>
      <div className="mt-4">
        <KenbeiFlow compare tone={emphasize ? "dark" : "light"} />
      </div>
      <p className={`mt-4 text-sm leading-6 ${ink}`}>{BILLING_SUPPORT}</p>

      <article
        className={`mt-5 rounded-2xl p-4 ${
          emphasize ? "bg-white/10" : "bg-white ring-1 ring-[var(--kb-line)]"
        } ${normalized === "free" ? "ring-2 ring-[var(--kb-amber)]" : ""}`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-[var(--kb-amber)]">FREE</p>
          {normalized === "free" ? <p className="text-sm font-medium">利用中</p> : null}
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{monthlyPriceLabel("free")}</p>
        <p className={`mt-1 text-sm ${emphasize ? "text-white/70" : "text-zinc-500"}`}>{seatRangeLabel("free")}</p>
        <p className={`mt-2 text-sm leading-6 ${emphasize ? "text-white/85" : "text-zinc-600"}`}>{planUseLine("free")}</p>
      </article>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <article
          className={`rounded-2xl p-5 ${
            emphasize ? "bg-white text-[var(--kb-ink)]" : "bg-white ring-1 ring-[var(--kb-line)]"
          } ${normalized === "standard" ? "ring-2 ring-[var(--kb-amber)]" : "ring-1 ring-[var(--kb-amber)]/40"}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-[var(--kb-amber)]">STANDARD</p>
            <span className="rounded-full bg-[#fff4eb] px-2 py-0.5 text-xs font-medium text-[var(--kb-amber)]">
              会社導入
            </span>
            {normalized === "standard" ? <span className="text-sm font-medium">契約中</span> : null}
          </div>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{monthlyPriceLabel("standard")}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {seatRangeLabel("standard")} / {standardScopeLine()}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{planUseLine("standard")}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{standardFlatNote()}</p>
          <div className="mt-4">
            <PlanCheckoutForm planCode="standard" label="STANDARDを導入" />
          </div>
        </article>
        <article
          className={`rounded-2xl p-4 ${
            emphasize ? "bg-white text-[var(--kb-ink)]" : "bg-white ring-1 ring-[var(--kb-line)]"
          } ${normalized === "business" ? "ring-2 ring-[var(--kb-amber)]" : ""}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-[var(--kb-amber)]">BUSINESS</p>
            {normalized === "business" ? <span className="text-sm font-medium">契約中</span> : null}
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{monthlyPriceLabel("business")}</p>
          <p className="mt-1 text-sm text-zinc-500">{seatRangeLabel("business")}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{planUseLine("business")}</p>
          <div className="mt-4">
            <PlanCheckoutForm
              planCode="business"
              label="BUSINESSを導入"
              buttonClassName={emphasize ? "bg-[var(--kb-ink)] text-white" : undefined}
            />
          </div>
        </article>
      </div>

      <article
        className={`mt-3 rounded-2xl p-4 text-sm ${
          emphasize ? "bg-white/10 text-white/85" : "bg-zinc-50 text-zinc-600"
        }`}
      >
        <p className="font-medium">51名以上</p>
        <p className="mt-1">{planUseLine("enterprise")}</p>
      </article>

      {variant === "settings" ? (
        <p className={`mt-4 text-sm ${muted}`}>
          契約の確認や解約は{" "}
          <a href="/settings/billing" className={`underline ${emphasize ? "text-white" : "text-zinc-800"}`}>
            プラン・お支払い
          </a>
          から進めます。
        </p>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">
          ダウングレードや支払い方法の変更は、下のカスタマーポータルから行います。
        </p>
      )}
    </section>
  );
}
