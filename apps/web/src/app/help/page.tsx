import type { Metadata } from "next";
import Link from "next/link";
import { HELP_SECTIONS } from "@/features/help/help-content";
import { KENBEI_SUPPORT_EMAIL, KENBEI_SUPPORT_MAILTO } from "@/features/marketing/contact";
import { MarketingFrame } from "@/features/marketing/marketing-frame";

export const metadata: Metadata = {
  title: "使い方・よくある質問 | KENBEI",
  description: "KENBEI の初めての設定、作業員のログイン、毎日の使い方、料金・請求書払いについて。",
};

export default function HelpPage() {
  return (
    <MarketingFrame>
      <article className="mx-auto mt-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">使い方・よくある質問</h1>
        <nav className="mt-6 flex flex-wrap gap-2" aria-label="目次">
          {HELP_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium ring-1 ring-[var(--kb-line)]"
            >
              {section.title}
            </a>
          ))}
        </nav>
        {HELP_SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="mt-10 scroll-mt-6">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <div className="mt-3 divide-y divide-[var(--kb-line)] rounded-2xl bg-white ring-1 ring-[var(--kb-line)]">
              {section.items.map((item) => (
                <details key={item.q} className="p-4">
                  <summary className="cursor-pointer text-base font-medium leading-7">
                    <span className="mr-2 text-[var(--kb-accent)]">Q.</span>
                    {item.q}
                  </summary>
                  <div className="mt-2 space-y-2 text-base leading-7 text-zinc-700">
                    {item.a.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
        <section className="mt-12 rounded-2xl bg-zinc-50 p-5 ring-1 ring-[var(--kb-line)]">
          <h2 className="text-lg font-semibold">解決しないとき</h2>
          <p className="mt-2 text-base leading-7 text-zinc-700">
            会社名と、どの画面で困っているか（できれば画面の写真）を添えて、メールでご連絡ください。
          </p>
          <p className="mt-3">
            <a href={KENBEI_SUPPORT_MAILTO} className="text-base font-medium underline">
              {KENBEI_SUPPORT_EMAIL}
            </a>
          </p>
        </section>
        <p className="mt-8 text-sm">
          <Link href="/" className="underline">
            トップへ
          </Link>
        </p>
      </article>
    </MarketingFrame>
  );
}
