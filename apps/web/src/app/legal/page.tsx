import type { Metadata } from "next";
import type { ReactNode } from "react";
import { KENBEI_MAX_MEMBERS, KENBEI_MONTHLY_PRICE_JPY } from "@kensapo/domain";
import { KENBEI_LEGAL, KENBEI_SUPPORT_EMAIL, KENBEI_SUPPORT_MAILTO } from "@/features/marketing/contact";
import { MarketingFrame } from "@/features/marketing/marketing-frame";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | KENBEI",
  description: "KENBEIの特定商取引法に基づく表記。",
};

const PRICE = KENBEI_MONTHLY_PRICE_JPY.toLocaleString("ja-JP");

export default function LegalPage() {
  const rows: { label: string; value: ReactNode }[] = [
    { label: "販売事業者", value: KENBEI_LEGAL.seller },
    { label: "運営責任者", value: KENBEI_LEGAL.representative },
    { label: "所在地", value: KENBEI_LEGAL.address },
    { label: "電話番号", value: KENBEI_LEGAL.phone },
    {
      label: "メールアドレス",
      value: (
        <a href={KENBEI_SUPPORT_MAILTO} className="underline">
          {KENBEI_SUPPORT_EMAIL}
        </a>
      ),
    },
    { label: "販売価格", value: `月額${PRICE}円（税込）。会社ごと・メンバー${KENBEI_MAX_MEMBERS}名まで。` },
    { label: "商品代金以外の必要料金", value: "インターネット接続にかかる通信料はお客様のご負担です。" },
    { label: "お支払い方法", value: "クレジットカード（Stripeによる決済）" },
    { label: "お支払い時期", value: "ご契約時に初回分を、以後は毎月同日に自動で請求します。" },
    { label: "サービスの提供時期", value: "お支払い手続きの完了後、すぐにご利用いただけます。" },
    {
      label: "無料体験",
      value: "14日間の無料体験があります。体験の開始にカード登録は不要で、自動で有料に切り替わることはありません。",
    },
    {
      label: "解約・返金",
      value:
        "アプリ内の「ご契約」画面からいつでも解約でき、現在の請求期間の終了時に解約されます。日割り計算による返金は行いません。",
    },
    { label: "動作環境", value: "最新版のChrome・Safari・Edgeなど、一般的なWebブラウザ（スマートフォン可）。" },
  ];
  return (
    <MarketingFrame>
      <article className="mx-auto mt-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">特定商取引法に基づく表記</h1>
        <dl className="mt-8 overflow-hidden rounded-3xl bg-white ring-1 ring-[var(--kb-line)]">
          {rows.map((row, index) => (
            <div
              key={row.label}
              className={`grid gap-1 px-5 py-4 text-sm leading-6 sm:grid-cols-[11rem_1fr] sm:gap-4 ${
                index > 0 ? "border-t border-[var(--kb-line)]" : ""
              }`}
            >
              <dt className="font-medium text-zinc-500">{row.label}</dt>
              <dd className="text-zinc-800">{row.value}</dd>
            </div>
          ))}
        </dl>
      </article>
    </MarketingFrame>
  );
}
