import { notFound } from "next/navigation";
import { PrintButton } from "@/features/sites/print-button";
import { searchPhotos } from "@/features/photos/queries";
import { requireWorkspace } from "@/lib/authz-guard";
import { formatDate } from "@/lib/site-dates";

export const dynamic = "force-dynamic";

/** 印刷専用（ヘッダー・ナビなし）。A4・余白16mm・2列。 */
export default async function SitePhotoPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ids?: string }>;
}) {
  const { id } = await params;
  const { ids } = await searchParams;
  await requireWorkspace();
  const selectedIds = (ids ?? "").split(",").filter(Boolean).slice(0, 200);
  if (selectedIds.length === 0) {
    notFound();
  }
  const photos = await searchPhotos({ projectId: id });
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const printable = selectedIds
    .map((photoId) => byId.get(photoId))
    .filter((photo): photo is NonNullable<typeof photo> => Boolean(photo?.url));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <p className="text-lg font-bold text-gray-800">{printable.length}枚の写真</p>
        <PrintButton />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {printable.map((photo) => (
          <figure key={photo.id} className="break-inside-avoid">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url ?? ""}
              alt={photo.comment ?? "現場の写真"}
              className="w-full rounded-lg border border-gray-300 object-cover"
            />
            <figcaption className="mt-1 text-sm text-gray-700">
              {formatDate(photo.takenAt)}
              {photo.locationSpot ? ` ${photo.locationSpot}` : ""}
              {photo.comment ? ` ${photo.comment}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
