import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AcceptPhotoButton } from "@/features/photos/accept-button";
import { PhotoAssistButton } from "@/features/photos/assist-button";
import { PhotoEditForm } from "@/features/photos/edit-form";
import { PhotoCreateTaskForm } from "@/features/photos/create-task-form";
import { getPhoto } from "@/features/photos/queries";
import { deletePhotoAction } from "@/features/photos/actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { can, isSiteAdmin, requireWorkspace } from "@/lib/authz-guard";
import { tokyoTodayIso } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function PhotoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const workspace = await requireWorkspace();
  const { id } = await params;
  const photo = await getPhoto(id);
  if (!photo) {
    notFound();
  }
  const canTask = can(workspace, "project.update") || can(workspace, "capture.create");
  const canDelete = photo.capturedBy === workspace.userId || isSiteAdmin(workspace);

  return (
    <AppShell>
      <p className="text-sm text-zinc-500">
        <Link href="/photos">写真</Link>
        {photo.projectId ? (
          <>
            {" / "}
            <Link href={`/projects/${photo.projectId}?tab=photos`}>{photo.projectName}</Link>
          </>
        ) : null}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">写真の整理</h1>
      {photo.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.url} alt="" decoding="async" className="mt-6 w-full rounded-3xl object-cover" />
      ) : null}
      <p className="mt-4 text-sm text-zinc-500">
        撮影 {photo.takenAt.slice(0, 16).replace("T", " ")} / {photo.capturedByName ?? "不明"}
      </p>
      {photo.classificationStatus === "proposed" ? (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
          <p>自動整理の候補です。業務記録にする前に確認してください。</p>
          <p className="mt-2">
            {photo.proposedWorkTypeKey} {photo.proposedLocationSpot} {photo.proposedDescription}
          </p>
          <div className="mt-3">
            <AcceptPhotoButton photoId={photo.id} />
          </div>
        </div>
      ) : null}
      <div className="mt-4">
        <PhotoAssistButton photoId={photo.id} />
      </div>
      <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
        <PhotoEditForm photo={photo} />
      </div>
      {canTask && photo.projectId ? (
        <PhotoCreateTaskForm
          photoId={photo.id}
          projectId={photo.projectId}
          projectName={photo.projectName}
          proposedDescription={photo.proposedDescription}
          comment={photo.comment}
          workTypeKey={photo.workTypeKey}
          locationSpot={photo.locationSpot}
          defaultDueOn={tokyoTodayIso()}
        />
      ) : null}
      {canDelete ? (
        <div className="mt-8">
          <ConfirmDeleteButton
            action={deletePhotoAction.bind(null, photo.id)}
            label="この写真を消す"
            confirmText="この写真を消しますか？消すと、現場の写真一覧と日報の下書きから外れます。"
            afterHref={photo.projectId ? `/projects/${photo.projectId}?tab=photos` : "/photos"}
          />
        </div>
      ) : null}
    </AppShell>
  );
}
