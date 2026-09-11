import type { ReactNode } from "react";

/** Nav chrome lives in the root layout so page transitions keep the bar visible. */
export function AppShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
