import { KENBEI_MONTHLY_PRICE_JPY } from "@kensapo/domain";
import { LANDING_FAQS, LANDING_LEAD } from "@/features/marketing/landing-copy";
import { KENBEI_OPERATOR_NAME, KENBEI_OPERATOR_URL, KENBEI_SITE_URL } from "@/features/marketing/contact";

/** 検索結果に料金やよくある質問を出してもらうための構造化データ（schema.org） */
export function LandingStructuredData() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "KENBEI",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      url: KENBEI_SITE_URL,
      image: `${KENBEI_SITE_URL}/og.png`,
      description: LANDING_LEAD,
      offers: {
        "@type": "Offer",
        price: KENBEI_MONTHLY_PRICE_JPY,
        priceCurrency: "JPY",
        description: "月額・税込・会社ごと。14日間無料。",
      },
      publisher: { "@type": "Organization", name: KENBEI_OPERATOR_NAME, url: KENBEI_OPERATOR_URL },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: LANDING_FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
  ];
  return (
    <script
      type="application/ld+json"
      // JSON の中の "<" をエスケープして、文字列から </script> が作れないようにする
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
