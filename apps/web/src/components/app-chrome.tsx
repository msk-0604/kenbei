"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { hideAppChrome } from "@/lib/public-path";

export function AppChrome({
  children,
  orgSwitcher,
  trialBanner,
  signedIn = false,
  canOpenSettings = false,
}: {
  children: ReactNode;
  orgSwitcher: ReactNode;
  trialBanner?: ReactNode;
  signedIn?: boolean;
  canOpenSettings?: boolean;
}) {
  const pathname = usePathname();
  if (hideAppChrome(pathname, signedIn)) {
    return <>{children}</>;
  }
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 pt-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:max-w-4xl md:px-8 md:pb-12 md:pt-8">
      <AppNav orgSwitcher={orgSwitcher} canOpenSettings={canOpenSettings} />
      {trialBanner}
      <div className="pb-4 md:pb-0">{children}</div>
    </div>
  );
}
