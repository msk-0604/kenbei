import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TodayView } from "@/features/today/today-view";
import { loadTodayBoard } from "@/features/today/queries";
import { loadOnboardingFlags } from "@/features/onboarding/queries";
import { MarketingLandingPage } from "@/features/marketing/landing-page";
import { getDecisionEngine } from "@/lib/engines";
import { getWorkspace, hasOrganization } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const workspace = await getWorkspace();
  if (workspace) {
    return {};
  }
  return {
    title: "KENBEI | 施工管理・現場管理",
    description: "現場写真・タスク・進捗・日報をひとつの流れで管理する施工管理Webサービス「KENBEI」。",
    openGraph: {
      title: "KENBEI | 施工管理・現場管理",
      description: "現場写真・タスク・進捗・日報をひとつの流れで管理する施工管理Webサービス「KENBEI」。",
    },
  };
}

export default async function HomePage() {
  const workspace = await getWorkspace();
  if (!workspace) {
    return <MarketingLandingPage />;
  }
  if (!hasOrganization(workspace)) {
    redirect("/onboarding");
  }

  const [{ projects, ops, pendingCaptureId, focusTasks }, onboarding, signals] = await Promise.all([
    loadTodayBoard(workspace),
    loadOnboardingFlags(workspace),
    getDecisionEngine().listForToday(workspace.organizationId, workspace.membershipId),
  ]);

  return (
    <AppShell>
      <TodayView
        workspace={workspace}
        projects={projects}
        ops={ops}
        pendingCaptureId={pendingCaptureId}
        onboarding={onboarding}
        signals={signals.map((item) => ({
          id: item.id,
          title: item.title,
          reason: String(item.evidence.reason ?? ""),
        }))}
        focusTasks={focusTasks}
      />
    </AppShell>
  );
}
