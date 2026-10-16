import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { PhotoGallery } from "@/features/sites/photo-gallery";
import { getSite } from "@/features/sites/queries";
import { searchPhotos } from "@/features/photos/queries";
import { requireWorkspace } from "@/lib/authz-guard";
import { formatDate } from "@/lib/site-dates";

export const dynamic = "force-dynamic";

export default async function SitePhotoGalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireWorkspace();
  const site = await getSite(id);
  if (!site) {
    notFound();
  }
  const photos = await searchPhotos({ projectId: id });
  return (
    <>
      <PageHeader title="写真を選ぶ" description={site.name} backHref={`/sites/${id}`} backLabel="現場に戻る" />
      <PhotoGallery
        projectId={id}
        photos={photos
          .filter((photo) => photo.url)
          .map((photo) => ({
            id: photo.id,
            url: photo.url ?? "",
            label: [formatDate(photo.takenAt), photo.locationSpot, photo.comment].filter(Boolean).join(" "),
          }))}
      />
    </>
  );
}
