import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TodayView } from "@/features/today/today-view";
import { loadTodayBoard } from "@/features/today/queries";
import { loadOnboardingFlags } from "@/features/onboarding/queries";
import { MarketingLandingPage } from "@/features/marketing/landing-page";
import { getWorkspace, hasOrganization } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const workspace = await getWorkspace();
  if (workspace) {
    return {};
  }
  return {
    title: "KENBEI | 現場が終わったら、15分で日報まで。月額9,800円",
    description:
      "施工管理者・現場監督向け。写真を撮る、作業にチェック、日報を出すの3ステップ。会社まるごと月額9,800円（税込）、14日間無料。",
    openGraph: {
      title: "KENBEI | 現場が終わったら、15分で日報まで。月額9,800円",
      description:
        "施工管理者・現場監督向け。写真を撮る、作業にチェック、日報を出すの3ステップ。会社まるごと月額9,800円（税込）、14日間無料。",
    },
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; project?: string }>;
}) {
  const workspace = await getWorkspace();
  if (!workspace) {
    return <MarketingLandingPage />;
  }
  if (!hasOrganization(workspace)) {
    redirect("/onboarding");
  }

  const params = await searchParams;
  const [{ projects, ops, pendingCaptureId, focusTasks }, onboarding] = await Promise.all([
    loadTodayBoard(workspace),
    loadOnboardingFlags(workspace),
  ]);

  return (
    <AppShell>
      <TodayView
        workspace={workspace}
        projects={projects}
        ops={ops}
        pendingCaptureId={pendingCaptureId}
        onboarding={onboarding}
        focusTasks={focusTasks}
        selectedProjectId={params.project ?? null}
        createdProject={params.created === "project"}
      />
    </AppShell>
  );
}
