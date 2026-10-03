import Link from "next/link";
import {
  HOW_TO_STEPS,
  LANDING_FAQS,
  LANDING_LEAD,
  LANDING_PAINS,
  TRIAL_NO_CARD_LINE,
  landingPlan,
  memberLimitLabel,
  monthlyYenLabel,
} from "@/features/marketing/landing-copy";
import { KENBEI_INCLUDED, dailyPriceLabel } from "@/features/billing/plan-copy";
import { MarketingCta, MarketingFrame } from "@/features/marketing/marketing-frame";

export function MarketingLandingPage() {
  const plan = landingPlan();

  return (
    <MarketingFrame>
      <section className="mt-10 md:mt-16">
        <p className="inline-flex rounded-full bg-white px-3 py-1 text-sm font-medium text-[var(--kb-accent)] ring-1 ring-[var(--kb-line)]">
          施工管理者・現場監督のための現場事務ツール
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          現場が終わったら、
          <br />
          <span className="kb-brand-text">15分</span>で日報まで。
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600 md:text-lg">{LANDING_LEAD}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <MarketingCta href="/signup">14日間無料で試す</MarketingCta>
          <MarketingCta href="#price" variant="secondary">
            料金を見る
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
        <h2 className="text-2xl font-semibold tracking-tight">現場の事務、こう変わります</h2>
        <ul className="mt-5 grid gap-3 md:grid-cols-3">
          {LANDING_PAINS.map((item) => (
            <li key={item.before} className="rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
              <p className="text-sm text-zinc-500 line-through decoration-zinc-300">{item.before}</p>
              <p className="mt-2 text-lg font-semibold">{item.after}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">使い方は3つだけ</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          覚えることはありません。開いた画面の一番上のボタンを、上から順に押すだけです。
        </p>
        <ol className="mt-5 grid gap-3 md:grid-cols-3">
          {HOW_TO_STEPS.map((step, index) => (
            <li key={step.title} className="rounded-3xl bg-[var(--kb-card)] p-5 ring-1 ring-[var(--kb-line)]">
              <p className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--kb-ink)] text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <span className="text-xl font-semibold">{step.title}</span>
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-700">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="price" className="mt-16 scroll-mt-8">
        <h2 className="text-2xl font-semibold tracking-tight">料金</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          プランはひとつだけ。人数で値段が変わったり、機能が削られたりしません。
        </p>
        <article className="mt-5 kb-elev overflow-hidden rounded-3xl bg-white ring-1 ring-[var(--kb-line)] md:grid md:grid-cols-2">
          <div className="bg-[var(--kb-ink)] p-6 text-white md:p-8">
            <p className="text-sm font-medium text-sky-300">{plan.name}</p>
            <p className="mt-3 text-5xl font-semibold tabular-nums tracking-tight">
              {monthlyYenLabel(plan.monthlyPriceJpy)}
            </p>
            <p className="mt-2 text-sm text-white/70">
              税込・会社ごと・{memberLimitLabel(plan.maxMembers)}（{dailyPriceLabel()}）
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <MarketingCta href="/signup" variant="accent">
                まず14日間無料で試す
              </MarketingCta>
            </div>
            <p className="mt-3 text-sm text-white/70">{TRIAL_NO_CARD_LINE}自動課金もしません。</p>
          </div>
          <ul className="flex flex-col justify-center gap-3 p-6 text-base leading-7 text-zinc-700 md:p-8">
            {KENBEI_INCLUDED.map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden className="font-semibold text-[var(--kb-accent)]">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </article>
        <p className="mt-3 text-sm text-zinc-500">
          {plan.maxMembers != null ? `${plan.maxMembers + 1}名以上` : "大人数"}でのご利用は
          <Link href="/contact" className="mx-1 underline">
            お問い合わせ
          </Link>
          ください。
        </p>
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
        <h2 className="text-2xl font-semibold tracking-tight">今日の現場から、試してみてください。</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          14日間無料。続けるなら月額9,800円（税込）。{TRIAL_NO_CARD_LINE}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <MarketingCta href="/signup">14日間無料で試す</MarketingCta>
          <MarketingCta href="/contact" variant="secondary">
            導入について相談する
          </MarketingCta>
        </div>
      </section>
    </MarketingFrame>
  );
}
