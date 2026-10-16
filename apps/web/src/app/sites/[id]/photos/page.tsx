import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { PhotoUploader } from "@/features/photos/uploader";
import { getSite } from "@/features/sites/queries";
import { can, requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function SitePhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireWorkspace();
  const site = await getSite(id);
  if (!site) {
    notFound();
  }
  return (
    <>
      <PageHeader
        title="写真を追加"
        description={`現場名：${site.name}`}
        backHref={`/sites/${id}`}
        backLabel="現場の画面に戻る"
      />
      {can(workspace, "photo.create") ? (
        <PhotoUploader
          organizationId={workspace.organizationId}
          projectId={id}
          projectName={site.name}
          companyName={workspace.organizationName}
          canCreateReport={can(workspace, "capture.confirm") || can(workspace, "project.update")}
        />
      ) : (
        <p className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-lg text-amber-900">
          写真を登録する権限がありません。
        </p>
      )}
    </>
  );
}
