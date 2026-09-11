import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { AppChrome } from "@/components/app-chrome";
import { OrgSwitcher } from "@/features/org/org-switcher";
import { getWorkspace } from "@/lib/session";
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

async function OrgSwitcherSlot() {
  const workspace = await getWorkspace();
  if (!workspace?.organizationId) {
    return null;
  }
  return <OrgSwitcher currentId={workspace.organizationId} organizations={workspace.organizations} />;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh bg-[var(--kb-paper)] text-[var(--kb-ink)] antialiased">
        <AppChrome
          orgSwitcher={
            <Suspense fallback={<div className="h-10 w-16" />}>
              <OrgSwitcherSlot />
            </Suspense>
          }
        >
          {children}
        </AppChrome>
      </body>
    </html>
  );
}
