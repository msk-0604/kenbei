import type { MetadataRoute } from "next";
import { KENBEI_SITE_URL } from "@/features/marketing/contact";

/** 検索エンジンに見てほしいのは公開ページだけ。ログイン後の画面と API は載せない。 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/help", "/sample", "/legal", "/terms", "/privacy", "/signup", "/login"],
      disallow: ["/api/", "/auth/", "/today", "/kanri", "/sites", "/projects", "/reports", "/settings", "/ops"],
    },
    sitemap: `${KENBEI_SITE_URL}/sitemap.xml`,
    host: KENBEI_SITE_URL,
  };
}
