import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EmptyGuide } from "@/components/empty-guide";
import { AppLink } from "@/components/app-nav";
import { PhotoUploader } from "@/features/photos/uploader";
import { ProjectPicker } from "@/features/photos/project-picker";
import { listTodayProjects } from "@/features/today/queries";
import { listProjects } from "@/features/projects/queries";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { CREATE_PROJECT_PATH } from "@/features/projects/routes";

export const dynamic = "force-dynamic";

export default async function PhotoUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const workspace = await requireWorkspace();
  const params = await searchParams;
  const [today, projects] = await Promise.all([listTodayProjects(workspace), listProjects()]);
  const projectId = params.projectId ?? today[0]?.projectId ?? projects[0]?.id ?? "";
  const canUpload = can(workspace, "photo.create");
  const selected = projects.find((project) => project.id === projectId);

  return (
    <AppShell>
      <p className="text-sm text-zinc-500">
        <Link href="/photos">写真</Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">写真を追加</h1>
      <p className="mt-2 text-base text-zinc-600">現場を選んで、写真を選ぶだけです。</p>
      <div className="mt-6">
        {projects.length > 0 ? <ProjectPicker projectId={projectId} projects={projects} /> : null}
      </div>
      <div className="mt-6">
        {canUpload && projectId ? (
          <PhotoUploader
            organizationId={workspace.organizationId}
            projectId={projectId}
            projectName={selected?.name}
            companyName={workspace.organizationName}
            canCreateReport={can(workspace, "capture.confirm") || can(workspace, "project.update")}
          />
        ) : (
          <EmptyGuide
            title="先に現場を登録"
            body="写真は現場に紐づけます。現場名を登録してから撮りましょう。"
            action={
              can(workspace, "project.create") ? <AppLink href={CREATE_PROJECT_PATH}>現場を作成</AppLink> : undefined
            }
          />
        )}
      </div>
    </AppShell>
  );
}
