import Link from "next/link";
import { KenbeiFlow } from "@/features/product/kenbei-flow";
import {
  HOW_TO_STEPS,
  LANDING_FAQS,
  LANDING_HEADLINE,
  LANDING_LEAD,
  TRIAL_NO_CARD_LINE,
  landingPaidPlans,
  memberLimitLabel,
  monthlyYenLabel,
} from "@/features/marketing/landing-copy";
import { MarketingCta, MarketingFrame } from "@/features/marketing/marketing-frame";

export function MarketingLandingPage() {
  const plans = landingPaidPlans();

  return (
    <MarketingFrame>
      <section className="mt-10 md:mt-16">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{LANDING_HEADLINE}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 md:text-lg">{LANDING_LEAD}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <MarketingCta href="/signup">14日間無料で試す</MarketingCta>
          <MarketingCta href="/contact" variant="secondary">
            導入について相談する
          </MarketingCta>
        </div>
        <p className="mt-3 text-sm text-zinc-500">{TRIAL_NO_CARD_LINE}</p>
        <p className="mt-4 text-sm text-zinc-600">
          すでにご利用中の方は{" "}
          <Link href="/login" className="font-medium underline">
            ログイン
          </Link>
        </p>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">使い方</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          写真、残作業、日報を同じ流れで扱います。画面の撮影素材は、公開できるものが揃い次第掲載します。
        </p>
        <ol className="mt-5 flex flex-col gap-3">
          {HOW_TO_STEPS.map((step, index) => (
            <li key={step.title} className="rounded-3xl bg-[var(--kb-card)] p-5 ring-1 ring-[var(--kb-line)]">
              <p className="text-sm font-medium text-[var(--kb-amber)]">
                {index + 1}. {step.title}
              </p>
              <p className="mt-2 text-base leading-7 text-zinc-700">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
          <p className="text-sm font-medium text-zinc-500">流れ</p>
          <div className="mt-2">
            <KenbeiFlow />
          </div>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">料金</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          比較表は、リポジトリのプラン定義で確認できた項目だけを載せています。税込・税別、保存容量、機能差、AI利用制限はここに書いていません。
        </p>
        <div className="mt-5 overflow-x-auto rounded-3xl bg-[var(--kb-card)] ring-1 ring-[var(--kb-line)]">
          <table className="w-full min-w-[20rem] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--kb-line)]">
                <th className="px-4 py-3 font-medium text-zinc-500">項目</th>
                {plans.map((plan) => (
                  <th key={plan.code} className="px-4 py-3 font-medium text-[var(--kb-ink)]">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--kb-line)]">
                <th className="px-4 py-3 font-medium text-zinc-500">月額</th>
                {plans.map((plan) => (
                  <td key={plan.code} className="px-4 py-3 tabular-nums font-semibold">
                    {monthlyYenLabel(plan.monthlyPriceJpy)}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-500">人数</th>
                {plans.map((plan) => (
                  <td key={plan.code} className="px-4 py-3">
                    {memberLimitLabel(plan.maxMembers)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <article className="mt-4 rounded-3xl bg-[var(--kb-ink)] p-5 text-white">
          <p className="text-sm font-medium text-amber-200">14日間無料体験</p>
          <p className="mt-3 text-base leading-7 text-white/85">
            まず14日間、無料で試せます。{TRIAL_NO_CARD_LINE}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <MarketingCta href="/signup">14日間無料で試す</MarketingCta>
            <MarketingCta href="/contact" variant="secondary">
              導入について相談する
            </MarketingCta>
          </div>
        </article>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">よくある質問</h2>
        <dl className="mt-5 flex flex-col gap-3">
          {LANDING_FAQS.map((item) => (
            <div key={item.q} className="rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
              <dt className="font-medium">{item.q}</dt>
              <dd className="mt-2 text-sm leading-6 text-zinc-600">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-16 rounded-3xl bg-[var(--kb-card)] p-6 ring-1 ring-[var(--kb-line)] md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight">14日間、無料で試せます。</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{TRIAL_NO_CARD_LINE}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <MarketingCta href="/signup">14日間無料で試す</MarketingCta>
          <MarketingCta href="/contact" variant="secondary">
            導入について相談する
          </MarketingCta>
        </div>
        <p className="mt-4 text-sm text-zinc-600">
          すでにご利用中の方は{" "}
          <Link href="/login" className="font-medium underline">
            ログイン
          </Link>
        </p>
      </section>
    </MarketingFrame>
  );
}
