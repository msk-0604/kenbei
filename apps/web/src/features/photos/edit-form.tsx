"use client";

import { useActionState } from "react";
import type { PhotoRecord } from "@/features/photos/queries";
import { updatePhotoAction } from "@/features/photos/actions";

export function PhotoEditForm({ photo }: { photo: PhotoRecord }) {
  const [state, action, pending] = useActionState(updatePhotoAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="photoId" value={photo.id} />
      <label className="text-sm font-medium">
        工種
        <input
          name="workTypeKey"
          defaultValue={photo.workTypeKey ?? ""}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-4"
        />
      </label>
      <label className="text-sm font-medium">
        施工箇所
        <input
          name="locationSpot"
          defaultValue={photo.locationSpot ?? ""}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-4"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium">
          階
          <input name="floor" defaultValue={photo.floor ?? ""} className="mt-1 w-full rounded-xl border border-zinc-200 px-4" />
        </label>
        <label className="text-sm font-medium">
          エリア
          <input name="area" defaultValue={photo.area ?? ""} className="mt-1 w-full rounded-xl border border-zinc-200 px-4" />
        </label>
      </div>
      <label className="text-sm font-medium">
        コメント
        <input name="comment" defaultValue={photo.comment ?? ""} className="mt-1 w-full rounded-xl border border-zinc-200 px-4" />
      </label>
      <label className="text-sm font-medium">
        タグ
        <input
          name="tags"
          defaultValue={photo.tags.join(" ")}
          placeholder="配管 トイレ"
          className="mt-1 w-full rounded-xl border border-zinc-200 px-4"
        />
      </label>
      {photo.classificationStatus === "proposed" ? (
        <p className="text-sm text-zinc-500">自動整理の候補です。保存すると確定します。</p>
      ) : null}
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-2xl bg-zinc-900 font-medium text-white">
        {pending ? "保存中…" : "保存"}
      </button>
    </form>
  );
}
