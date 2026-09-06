import { AppShell } from "@/components/app-shell";
import { VoiceRecorder } from "@/features/capture/voice-recorder";
import { listTodayProjects } from "@/features/today/queries";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { getProject } from "@/features/projects/queries";

export const dynamic = "force-dynamic";

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const workspace = await requireWorkspace();
  const today = await listTodayProjects(workspace);
  const params = await searchParams;
  const projectId = params.projectId ?? today[0]?.projectId;
  const project = projectId ? await getProject(projectId) : null;
  const canCapture = can(workspace, "capture.create");

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">話す</h1>
      <p className="mt-2 text-base text-zinc-600">{project?.name ?? "現場がありません"}</p>
      <div className="mt-12">
        {canCapture && projectId && project ? (
          <VoiceRecorder projectId={projectId} />
        ) : (
          <p className="text-base text-zinc-600">今日の現場が割り当てられると、ここで話せます。</p>
        )}
      </div>
    </AppShell>
  );
}
