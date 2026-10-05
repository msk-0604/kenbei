import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { hasPermission } from "@kensapo/authz";
import { AppChrome } from "@/components/app-chrome";
import { LaunchSplash } from "@/components/launch-splash";
import { OrgSwitcher } from "@/features/org/org-switcher";
import { TrialStatusBanner } from "@/features/billing/trial-status-banner";
import { getEntitlement } from "@/lib/entitlement";
import { getWorkspace } from "@/lib/session";
import "./globals.css";

// iPhoneでホーム画面から起動した直後の画面（オープニングと同じ見た目）。
// iOSは画面サイズにぴったり合う画像しか使わないため、機種ごとに用意している。
const IPHONE_SCREENS: [width: number, height: number, ratio: number][] = [
  [440, 956, 3],
  [420, 912, 3],
  [402, 874, 3],
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [375, 667, 2],
  [320, 568, 2],
];

const startupImage = IPHONE_SCREENS.map(([width, height, ratio]) => ({
  url: `/splash/iphone-${width * ratio}x${height * ratio}.png`,
  media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
}));

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
    startupImage,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b1220",
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
        <LaunchSplash signedIn={Boolean(workspace)} />
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
