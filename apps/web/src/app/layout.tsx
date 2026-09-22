import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { hasPermission } from "@kensapo/authz";
import { AppChrome } from "@/components/app-chrome";
import { OrgSwitcher } from "@/features/org/org-switcher";
import { TrialStatusBanner } from "@/features/billing/trial-status-banner";
import { getEntitlement } from "@/lib/entitlement";
import { getWorkspace } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "KENBEI",
  description: "現場の記録から、今日の事務まで。施工管理者のためのKENBEI。",
  applicationName: "KENBEI",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
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

async function TrialBannerSlot() {
  const workspace = await getWorkspace();
  if (!workspace?.organizationId) {
    return null;
  }
  const entitlement = await getEntitlement(workspace.organizationId);
  return (
    <TrialStatusBanner
      access={entitlement.access}
      daysRemaining={entitlement.trialDaysLeft}
      canManageBilling={hasPermission(workspace.permissions, "org.manage")}
    />
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const workspace = await getWorkspace();
  return (
    <html lang="ja">
      <body className="min-h-dvh bg-[var(--kb-paper)] text-[var(--kb-ink)] antialiased">
        <AppChrome
          signedIn={Boolean(workspace)}
          canOpenSettings={Boolean(
            workspace &&
              (hasPermission(workspace.permissions, "org.manage") ||
                hasPermission(workspace.permissions, "member.manage")),
          )}
          orgSwitcher={
            <Suspense fallback={<div className="h-10 w-16" />}>
              <OrgSwitcherSlot />
            </Suspense>
          }
          trialBanner={
            <Suspense fallback={null}>
              <TrialBannerSlot />
            </Suspense>
          }
        >
          {children}
        </AppChrome>
      </body>
    </html>
  );
}
