import type { ReactNode } from "react";
import { requireSiteAdmin } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

/** 管理画面は管理者だけ（各ページでも確認し、DB の RLS でも守る） */
export default async function KanriLayout({ children }: { children: ReactNode }) {
  await requireSiteAdmin();
  return <>{children}</>;
}
