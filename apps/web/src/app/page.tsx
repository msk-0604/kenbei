import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarketingLandingPage } from "@/features/marketing/landing-page";
import { getWorkspace, hasOrganization } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const workspace = await getWorkspace();
  if (workspace) {
    return {};
  }
  return {
    title: "KENBEI | 現場が終わったら、15分で日報まで。月額18,000円",
    description:
      "施工管理者・現場監督向け。写真を撮る、作業にチェック、日報を出すの3ステップ。会社まるごと月額18,000円（税込）、14日間無料。",
    openGraph: {
      title: "KENBEI | 現場が終わったら、15分で日報まで。月額18,000円",
      description:
        "施工管理者・現場監督向け。写真を撮る、作業にチェック、日報を出すの3ステップ。会社まるごと月額18,000円（税込）、14日間無料。",
    },
  };
}

/** ログイン後の最初の画面は「スケジュール」（/today）。未ログインはLP。 */
export default async function HomePage() {
  const workspace = await getWorkspace();
  if (!workspace) {
    return <MarketingLandingPage />;
  }
  if (!hasOrganization(workspace)) {
    redirect("/onboarding");
  }
  redirect("/today");
}
