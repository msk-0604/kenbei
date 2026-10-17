"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";

export type GalleryPhoto = {
  id: string;
  url: string;
  label: string;
};

/** iPhone の写真アプリのように「選択」で複数選び、「印刷する」で印刷画面へ */
export function PhotoGallery({ projectId, photos }: { projectId: string; photos: GalleryPhoto[] }) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggleSelecting() {
    setSelecting((current) => !current);
    setSelectedIds([]);
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  function handleTap(photo: GalleryPhoto) {
    if (selecting) {
      toggleSelect(photo.id);
      return;
    }
    router.push(`/photos/${photo.id}`);
  }

  function goToPrint() {
    if (selectedIds.length === 0) {
      return;
    }
    router.push(`/sites/${projectId}/photos/pdf?ids=${selectedIds.join(",")}`);
  }

  return (
    <section className="space-y-4">
      <div className="sticky top-[4.5rem] z-30 -mx-5 space-y-3 bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-bold text-gray-800">
            {selecting ? `${selectedIds.length}枚選択中` : `写真（${photos.length}枚）`}
          </p>
          <Button type="button" variant="secondary" size="md" onClick={toggleSelecting} disabled={photos.length === 0}>
            {selecting ? "キャンセル" : "選択"}
          </Button>
        </div>
        {selecting ? (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => setSelectedIds(photos.map((photo) => photo.id))}
            >
              すべて選択
            </Button>
            <Button type="button" size="md" fullWidth disabled={selectedIds.length === 0} onClick={goToPrint}>
              印刷する
            </Button>
          </div>
        ) : null}
      </div>

      {photos.length === 0 ? (
        <EmptyState title="まだ写真がありません" description="「写真を追加する」から、現場の写真を登録してください。" />
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((photo) => {
            const selected = selectedIds.includes(photo.id);
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => handleTap(photo)}
                aria-pressed={selecting ? selected : undefined}
                aria-label={photo.label}
                className="relative aspect-square overflow-hidden rounded-lg bg-gray-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.label} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                {selecting ? (
                  <>
                    <div className={cn("absolute inset-0 transition-colors", selected ? "bg-navy-950/40" : "bg-black/0")} />
                    <div
                      className={cn(
                        "absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2",
                        selected ? "border-white bg-navy-900 text-white" : "border-white bg-black/20",
                      )}
                    >
                      {selected ? <Check className="h-4 w-4" aria-hidden /> : null}
                    </div>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
