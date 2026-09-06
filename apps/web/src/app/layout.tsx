import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "KENBEI",
  description: "現場が終わってからの1〜2時間を、10〜15分にする。施工管理者のためのKENBEI。",
  applicationName: "KENBEI",
  appleWebApp: {
    capable: true,
    title: "KENBEI",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh bg-[var(--kb-paper)] text-[var(--kb-ink)] antialiased">{children}</body>
    </html>
  );
}
