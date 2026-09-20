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
}: {
  children: ReactNode;
  orgSwitcher: ReactNode;
  trialBanner?: ReactNode;
  signedIn?: boolean;
}) {
  const pathname = usePathname();
  if (hideAppChrome(pathname, signedIn)) {
    return <>{children}</>;
  }
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 pt-6 pb-[calc(8.5rem+env(safe-area-inset-bottom))] md:px-8 md:pb-12 md:pt-8">
      <AppNav orgSwitcher={orgSwitcher} />
      {trialBanner}
      <div className="pb-4 md:pb-0">{children}</div>
    </div>
  );
}
