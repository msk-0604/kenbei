"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";

function hideAppChrome(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/signup" || pathname === "/join" || pathname === "/onboarding") {
    return true;
  }
  if (pathname === "/forgot-password" || pathname === "/reset-password") {
    return true;
  }
  if (pathname.startsWith("/signup/") || pathname.startsWith("/auth/")) {
    return true;
  }
  if (pathname.endsWith("/print")) {
    return true;
  }
  return false;
}

export function AppChrome({
  children,
  orgSwitcher,
}: {
  children: ReactNode;
  orgSwitcher: ReactNode;
}) {
  const pathname = usePathname();
  if (hideAppChrome(pathname)) {
    return <>{children}</>;
  }
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
      <AppNav orgSwitcher={orgSwitcher} />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
