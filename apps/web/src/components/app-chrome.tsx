"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { PersonNameGate } from "@/components/person-name-gate";
import { hideAppChrome } from "@/lib/public-path";

export type ChromeViewer = {
  organizationId: string;
  displayName: string;
  companyName: string;
  isAdmin: boolean;
  isCrew: boolean;
};

export function AppChrome({
  children,
  orgSwitcher,
  trialBanner,
  signedIn = false,
  viewer,
}: {
  children: ReactNode;
  orgSwitcher: ReactNode;
  trialBanner?: ReactNode;
  signedIn?: boolean;
  viewer: ChromeViewer | null;
}) {
  const pathname = usePathname();
  if (hideAppChrome(pathname, signedIn)) {
    return <>{children}</>;
  }
  const shell = (
    <div className="flex min-h-dvh flex-col bg-white">
      <AppNav
        orgSwitcher={orgSwitcher}
        displayName={viewer?.displayName ?? ""}
        companyName={viewer?.companyName ?? ""}
        isAdmin={viewer?.isAdmin ?? false}
        usesDeviceName={viewer?.isCrew ?? false}
      />
      <main className="mx-auto w-full max-w-lg flex-1 overflow-x-hidden px-5 py-8 pb-[calc(9rem+env(safe-area-inset-bottom))]">
        {trialBanner}
        <div key={pathname} className="page-enter">
          {children}
        </div>
      </main>
    </div>
  );
  if (viewer?.isCrew) {
    return <PersonNameGate organizationId={viewer.organizationId}>{shell}</PersonNameGate>;
  }
  return shell;
}
