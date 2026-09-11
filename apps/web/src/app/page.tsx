import { AppShell } from "@/components/app-shell";
import { TodayView } from "@/features/today/today-view";
import { loadTodayBoard } from "@/features/today/queries";
import { loadOnboardingFlags } from "@/features/onboarding/queries";
import { getDecisionEngine } from "@/lib/engines";
import { requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const workspace = await requireWorkspace();
  const [{ projects, ops, pendingCaptureId }, onboarding, signals] = await Promise.all([
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
      />
    </AppShell>
  );
}
