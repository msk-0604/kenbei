import type { Metadata } from "next";
import { KENBEI_SUPPORT_EMAIL, KENBEI_SUPPORT_MAILTO } from "@/features/marketing/contact";
import { MarketingFrame } from "@/features/marketing/marketing-frame";

export const metadata: Metadata = {
  title: "プライバシーポリシー | KENBEI",
  description: "KENBEIの個人情報の取り扱いについて。",
};

export default function PrivacyPage() {
  return (
    <MarketingFrame>
      <article className="mx-auto mt-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">プライバシーポリシー</h1>
        <p className="mt-3 text-sm text-zinc-500">KENBEI（施工管理・現場管理Webサービス）</p>
        <div className="mt-8 flex flex-col gap-6 text-base leading-7 text-zinc-700">
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">取得する情報</h2>
            <p className="mt-2">
              アカウント登録時のメールアドレス、会社名・現場名などの業務データ、写真、日報、タスク、端末やブラウザの利用ログを取り扱います。
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">利用目的</h2>
            <p className="mt-2">
              サービスの提供、認証、請求、障害対応、セキュリティ、利用状況の把握のために使用します。販売目的の名簿提供は行いません。
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">外部サービス</h2>
            <p className="mt-2">
              認証・データ保管に Supabase、有料プランの決済に Stripe、AI軍師の補助応答に OpenAI、障害監視に Sentry、配信に
              Vercel を利用します。各社の取り扱いに従います。
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">セキュリティ</h2>
            <p className="mt-2">
              組織ごとにデータを分けて扱います。通信は暗号化します。完全な安全性を保証するものではありません。
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">Cookie等</h2>
            <p className="mt-2">ログイン状態の維持やセキュリティのために Cookie を使用します。</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">問い合わせ</h2>
            <p className="mt-2">
              個人情報に関するお問い合わせは、
              <a href={KENBEI_SUPPORT_MAILTO} className="font-medium underline">
                {KENBEI_SUPPORT_EMAIL}
              </a>
              までご連絡ください。
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--kb-ink)]">改定</h2>
            <p className="mt-2">内容を改定する場合は、本ページを更新して周知します。</p>
          </section>
        </div>
      </article>
    </MarketingFrame>
  );
}
