import type { Metadata } from "next";
import { KENBEI_SUPPORT_EMAIL, KENBEI_SUPPORT_MAILTO } from "@/features/marketing/contact";
import { MarketingFrame } from "@/features/marketing/marketing-frame";

export const metadata: Metadata = {
  title: "お問い合わせ | KENBEI",
  description: "KENBEIへのお問い合わせ。",
};

export default function ContactPage() {
  return (
    <MarketingFrame>
      <article className="mx-auto mt-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">お問い合わせ</h1>
        <p className="mt-6 text-base leading-7 text-zinc-700">お問い合わせは、次のメールアドレスへご連絡ください。</p>
        <p className="mt-3">
          <a href={KENBEI_SUPPORT_MAILTO} className="text-base font-medium underline">
            {KENBEI_SUPPORT_EMAIL}
          </a>
        </p>
      </article>
    </MarketingFrame>
  );
}
