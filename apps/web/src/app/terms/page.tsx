import type { Metadata } from "next";
import { KENBEI_SUPPORT_EMAIL, KENBEI_SUPPORT_MAILTO } from "@/features/marketing/contact";
import { MarketingFrame } from "@/features/marketing/marketing-frame";

export const metadata: Metadata = {
  title: "利用規約 | KENBEI",
  description: "KENBEIの利用規約。",
};

export default function TermsPage() {
  return (
    <MarketingFrame>
      <article className="mx-auto mt-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">利用規約</h1>
        <p className="mt-3 text-sm text-zinc-500">KENBEI（施工管理・現場管理Webサービス）</p>
        <div className="mt-8 flex flex-col gap-6 text-base leading-7 text-zinc-700">
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">サービス概要</h2>
            <p className="mt-2">
              KENBEIは、現場写真・タスク・進捗・日報などをつなげる施工管理向けのWebサービスです。
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">アカウント</h2>
            <p className="mt-2">
              利用者は正確な情報で登録し、認証情報を適切に管理してください。会社の管理者は所属メンバーの利用に責任を負います。
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">禁止事項</h2>
            <p className="mt-2">
              法令違反、他者の権利侵害、不正アクセス、サービスの妨害、虚偽登録を禁止します。
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">無料体験と有料プラン</h2>
            <p className="mt-2">
              新規利用について、14日間の無料体験をご案内しています。継続利用は STANDARD または BUSINESS
              などの有料プランをご契約ください。料金はアプリ内の請求設定に表示される内容が優先されます。無料体験の開始だけで自動課金はしません。
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">支払い・解約</h2>
            <p className="mt-2">
              有料プランの支払いは Stripe を通じて行います。解約や支払い方法の変更は、権限のある管理者がアプリ内の請求設定および
              Stripe カスタマーポータルから行います。
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">データ</h2>
            <p className="mt-2">
              登録データは組織単位で扱います。解約後も当面は保持することがありますが、保管期間を保証するものではありません。重要なデータは利用者がエクスポートしてください。
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">AI機能</h2>
            <p className="mt-2">
              AI軍師の出力は補助情報です。現場判断・法令順守・安全の最終責任は利用者にあります。
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">変更・停止・免責</h2>
            <p className="mt-2">
              サービス内容の変更、一時停止、終了を行うことがあります。当社は、利用により生じた損害について、法令で認められる範囲を超えて責任を負いません。
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">規約変更</h2>
            <p className="mt-2">本規約を変更する場合は、本ページを更新します。</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">問い合わせ</h2>
            <p className="mt-2">
              本規約に関するお問い合わせは、
              <a href={KENBEI_SUPPORT_MAILTO} className="font-medium underline">
                {KENBEI_SUPPORT_EMAIL}
              </a>
              までご連絡ください。
            </p>
          </section>
        </div>
      </article>
    </MarketingFrame>
  );
}
