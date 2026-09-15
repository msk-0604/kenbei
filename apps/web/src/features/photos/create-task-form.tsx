"use client";

import { useState } from "react";
import Link from "next/link";
import { createTaskAction } from "@/features/site-ops/actions";

function titleFromPhoto(input: {
  proposedDescription: string | null;
  comment: string | null;
  workTypeKey: string | null;
  locationSpot: string | null;
}): string {
  const fromMemo = (input.proposedDescription ?? input.comment ?? "").trim();
  if (fromMemo) {
    return fromMemo.slice(0, 80);
  }
  return [input.workTypeKey, input.locationSpot].filter(Boolean).join(" ").slice(0, 80) || "写真の確認";
}

export function PhotoCreateTaskForm({
  photoId,
  projectId,
  projectName,
  proposedDescription,
  comment,
  workTypeKey,
  locationSpot,
  defaultDueOn,
}: {
  photoId: string;
  projectId: string;
  projectName: string | null;
  proposedDescription: string | null;
  comment: string | null;
  workTypeKey: string | null;
  locationSpot: string | null;
  defaultDueOn: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const title = titleFromPhoto({ proposedDescription, comment, workTypeKey, locationSpot });
  const description = [comment, proposedDescription, workTypeKey, locationSpot]
    .filter(Boolean)
    .join(" / ");

  return (
    <section className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
      <h2 className="text-base font-medium">この写真からタスクを追加</h2>
      <p className="mt-1 text-sm text-zinc-500">{projectName ?? "この現場"}の未完了として残します。</p>
      {created ? (
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <p className="text-emerald-800">タスクを追加しました。この写真は下からいつでも戻せます。</p>
          <Link href={`/projects/${projectId}?tab=tasks`} className="inline-flex min-h-12 items-center font-medium underline">
            現場のタスクを見る
          </Link>
          <Link href={`/photos/${photoId}`} className="inline-flex min-h-12 items-center font-medium underline">
            この写真に戻る
          </Link>
        </div>
      ) : (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            setPending(true);
            setError(null);
            void createTaskAction(null, formData).then((result) => {
              setPending(false);
              if (result?.error) {
                setError(result.error);
                return;
              }
              setCreated(true);
            });
          }}
        >
          <input type="hidden" name="projectId" value={projectId} />
          <label className="text-sm font-medium">
            タスク名
            <input
              name="title"
              required
              defaultValue={title}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-4"
            />
          </label>
          <label className="text-sm font-medium">
            説明
            <textarea
              name="description"
              defaultValue={description ? `${description}\n写真: /photos/${photoId}` : `写真: /photos/${photoId}`}
              className="mt-1 min-h-24 w-full rounded-xl border border-zinc-200 px-4 py-3"
            />
          </label>
          <label className="text-sm font-medium">
            期限
            <input
              type="date"
              name="dueOn"
              defaultValue={defaultDueOn}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={pending} className="min-h-12 rounded-2xl bg-zinc-900 font-medium text-white">
            {pending ? "追加中…" : "タスクを追加"}
          </button>
        </form>
      )}
    </section>
  );
}
