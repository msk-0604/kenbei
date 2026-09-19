import { KenbeiFlow } from "@/features/product/kenbei-flow";
import { MarketingCta, MarketingFrame } from "@/features/marketing/marketing-frame";

const FEATURES = [
  { title: "現場写真", body: "現場ごとの写真をまとめて管理。" },
  { title: "タスク・残作業", body: "現場で発生した作業を管理。" },
  { title: "進捗管理", body: "完了・未完了を確認。" },
  { title: "日報", body: "現場情報を日報につなげる。" },
  { title: "PDF", body: "日報をPDFとして出力。" },
  { title: "AI軍師", body: "現場管理を補助するAI機能。" },
] as const;

const FAQS = [
  {
    q: "14日間無料で使えますか？",
    a: "14日間の無料体験をご案内しています。正式契約はアプリ内の請求設定から行います。",
  },
  {
    q: "クレジットカードは必要ですか？",
    a: "無料体験の開始時には必要ありません。",
  },
  {
    q: "スマートフォンでも使えますか？",
    a: "Webブラウザから利用できます。",
  },
  {
    q: "日報をPDFにできますか？",
    a: "作成した日報をPDFとして出力できます。",
  },
  {
    q: "AIは何をしてくれますか？",
    a: "KENBEIのAI軍師が現場管理を補助します。AIの出力は補助情報として利用してください。",
  },
  {
    q: "無料体験後はどうなりますか？",
    a: "継続して利用する場合は、STANDARDまたはBUSINESSをご契約いただきます。",
  },
] as const;

export function MarketingLandingPage() {
  return (
    <MarketingFrame>
      <section className="mt-10 md:mt-16">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          現場の記録から、
          <br />
          会社の事務まで。
        </h1>
        <p className="mt-4 text-lg leading-7 text-zinc-700">
          写真・残作業・進捗・日報を、
          <br className="sm:hidden" />
          ひとつの流れで管理。
        </p>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
          KENBEIは、施工管理の現場で発生する写真・タスク・進捗・日報をつなげて管理する現場管理Webサービスです。
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <MarketingCta href="/signup">14日間無料で始める</MarketingCta>
          <MarketingCta href="/login" variant="secondary">
            ログイン
          </MarketingCta>
        </div>
        <p className="mt-3 text-sm text-zinc-500">クレジットカード不要</p>
      </section>

      <section className="mt-16 rounded-3xl bg-[var(--kb-card)] p-5 ring-1 ring-[var(--kb-line)] md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight">
          現場で生まれた情報を、
          <br />
          そのまま日報まで。
        </h2>
        <div className="mt-5">
          <KenbeiFlow />
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">従来との違い</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <article className="rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
            <p className="text-sm font-medium text-zinc-500">従来</p>
            <ul className="mt-3 flex flex-col gap-2 text-base leading-7 text-zinc-700">
              <li>写真がスマホ・LINEなどに分散</li>
              <li>残作業を口頭や別ツールで管理</li>
              <li>Excel等へ転記</li>
              <li>日報へもう一度入力</li>
            </ul>
          </article>
          <article className="rounded-3xl bg-[var(--kb-card)] p-5 ring-1 ring-[var(--kb-line)]">
            <p className="text-sm font-medium text-[var(--kb-amber)]">KENBEI</p>
            <div className="mt-3">
              <KenbeiFlow />
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-600">写真から残作業、進捗、日報、PDFまでをつなげます。</p>
          </article>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">主要機能</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((item) => (
            <li key={item.title} className="rounded-3xl bg-[var(--kb-card)] p-5 ring-1 ring-[var(--kb-line)]">
              <p className="font-medium">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">料金</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <article className="rounded-3xl bg-[var(--kb-ink)] p-5 text-white">
            <p className="text-sm font-medium text-amber-200">14日間無料体験</p>
            <p className="mt-3 text-base leading-7 text-white/85">
              まず14日間、KENBEIを無料でお試しいただけます。
            </p>
            <p className="mt-3 text-sm text-white/70">クレジットカード不要</p>
            <div className="mt-5">
              <MarketingCta href="/signup">14日間無料で始める</MarketingCta>
            </div>
          </article>
          <article className="rounded-3xl bg-[var(--kb-card)] p-5 ring-1 ring-[var(--kb-line)]">
            <p className="text-sm font-medium text-[var(--kb-amber)]">STANDARD</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">月額 39,800円</p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">現場管理に必要な基本機能を利用できます。</p>
            <div className="mt-5">
              <MarketingCta href="/signup">14日間無料で始める</MarketingCta>
            </div>
          </article>
          <article className="rounded-3xl bg-[var(--kb-card)] p-5 ring-1 ring-[var(--kb-line)]">
            <p className="text-sm font-medium text-[var(--kb-amber)]">BUSINESS</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">月額 65,000円</p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">より本格的な運用向け。</p>
            <div className="mt-5">
              <MarketingCta href="/signup">14日間無料で始める</MarketingCta>
            </div>
          </article>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">よくある質問</h2>
        <dl className="mt-5 flex flex-col gap-3">
          {FAQS.map((item) => (
            <div key={item.q} className="rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
              <dt className="font-medium">{item.q}</dt>
              <dd className="mt-2 text-sm leading-6 text-zinc-600">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-16 rounded-3xl bg-[var(--kb-card)] p-6 ring-1 ring-[var(--kb-line)] md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight">
          現場管理を、
          <br />
          ひとつの流れに。
        </h2>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <MarketingCta href="/signup">14日間無料で始める</MarketingCta>
          <MarketingCta href="/login" variant="secondary">
            ログイン
          </MarketingCta>
        </div>
      </section>
    </MarketingFrame>
  );
}
