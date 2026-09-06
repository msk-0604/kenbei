"use client";

import { useEffect, useState } from "react";
import {
  BLACKBOARD_FIELD_LABELS,
  blackboardToComment,
  emptyBlackboard,
  isAllowedImageType,
  MAX_PHOTOS_PER_BATCH,
  type ConstructionBlackboard,
} from "@kensapo/domain";
import { burnBlackboardOntoImage } from "@/lib/burn-blackboard";
import { loadBlackboardDraft, saveBlackboardDraft } from "@/lib/blackboard-store";
import { compressImageFile } from "@/lib/compress-image";
import { readJpegTakenAt } from "@/lib/exif";
import {
  countQueuedPhotos,
  enqueuePhotos,
  listQueuedPhotos,
  removeQueuedPhotos,
  type QueuedPhoto,
} from "@/lib/photo-queue";
import { extensionForMime, photoStoragePath } from "@/lib/storage-paths";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { registerPhotosAction } from "@/features/photos/actions";

type FieldKey = keyof ConstructionBlackboard;

const EDIT_FIELDS: FieldKey[] = [
  "projectName",
  "workType",
  "location",
  "description",
  "date",
  "companyName",
];

export function PhotoUploader({
  organizationId,
  projectId,
  projectName,
  companyName,
}: {
  organizationId: string;
  projectId: string;
  projectName?: string;
  companyName?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [useBlackboard, setUseBlackboard] = useState(true);
  const [board, setBoard] = useState<ConstructionBlackboard>(
    emptyBlackboard({ projectName: projectName ?? "", companyName: companyName ?? "" }),
  );

  async function refreshPending() {
    setPendingCount(await countQueuedPhotos());
  }

  useEffect(() => {
    setOnline(navigator.onLine);
    const syncOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    void refreshPending();
    void loadBlackboardDraft(organizationId, projectId).then((saved) => {
      setBoard(
        emptyBlackboard({
          ...saved,
          projectName: saved.projectName || projectName || "",
          companyName: saved.companyName || companyName || "",
        }),
      );
    });
    const onOnline = () => {
      void flushQueue();
    };
    window.addEventListener("online", onOnline);
    void flushQueue();
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      window.removeEventListener("online", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, projectId]);

  async function persistBoard(next: ConstructionBlackboard) {
    setBoard(next);
    await saveBlackboardDraft(organizationId, projectId, next);
  }

  async function uploadPrepared(items: QueuedPhoto[]): Promise<void> {
    const supabase = createBrowserSupabaseClient();
    const registered: {
      id: string;
      storagePath: string;
      takenAt: string;
      originalFilename: string;
      mimeType: string;
      comment?: string;
    }[] = [];
    const uploadedIds: string[] = [];
    for (const [index, item] of items.entries()) {
      setProgress(`${index + 1} / ${items.length} 枚を送信中`);
      const path = photoStoragePath(organizationId, projectId, item.id, extensionForMime(item.mimeType));
      const upload = await supabase.storage.from("org-files").upload(path, item.blob, {
        contentType: item.mimeType,
        upsert: false,
      });
      if (upload.error) {
        throw new Error(upload.error.message);
      }
      registered.push({
        id: item.id,
        storagePath: path,
        takenAt: item.takenAt,
        originalFilename: item.fileName,
        mimeType: item.mimeType,
        comment: item.comment,
      });
      uploadedIds.push(item.id);
      setDone(index + 1);
    }
    const result = await registerPhotosAction({ projectId, items: registered });
    if ("error" in result) {
      throw new Error(result.error);
    }
    await removeQueuedPhotos(uploadedIds);
    await refreshPending();
  }

  async function flushQueue() {
    if (!navigator.onLine || busy) {
      return;
    }
    const queued = (await listQueuedPhotos(projectId)).slice(0, MAX_PHOTOS_PER_BATCH);
    if (queued.length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await uploadPrepared(queued);
      setProgress(`${queued.length}枚の未送信を送りました`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "未送信の再送に失敗しました");
    } finally {
      setBusy(false);
      await refreshPending();
    }
  }

  async function onFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const files = [...fileList].slice(0, MAX_PHOTOS_PER_BATCH);
    setBusy(true);
    setError(null);
    setDone(0);
    try {
      await saveBlackboardDraft(organizationId, projectId, board);
      const prepared: QueuedPhoto[] = [];
      for (const [index, original] of files.entries()) {
        if (!isAllowedImageType(original.type)) {
          throw new Error("JPEG / PNG / WebP のみです。");
        }
        setProgress(`${index + 1} / ${files.length} 枚を準備中`);
        const compressed = await compressImageFile(original);
        const burned = useBlackboard
          ? await burnBlackboardOntoImage(compressed, board)
          : compressed;
        const takenAt = (await readJpegTakenAt(original)) ?? new Date().toISOString();
        prepared.push({
          id: crypto.randomUUID(),
          organizationId,
          projectId,
          fileName: useBlackboard
            ? original.name.replace(/(\.[^.]+)?$/, "-blackboard.jpg")
            : original.name,
          mimeType: "image/jpeg",
          takenAt,
          blob: burned,
          createdAt: Date.now(),
          comment: useBlackboard ? blackboardToComment(board) : undefined,
        });
        setDone(index + 1);
      }
      await enqueuePhotos(prepared);
      await refreshPending();
      if (!navigator.onLine) {
        setProgress(
          `${prepared.length}枚を端末に保存しました（黒板${useBlackboard ? "付き" : "なし"}）。電波が戻ると送ります。`,
        );
        return;
      }
      await uploadPrepared(prepared);
      setProgress(`${prepared.length}枚を保存しました`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "アップロードに失敗しました");
      setProgress("送れなかった写真は端末に残します");
    } finally {
      setBusy(false);
      await refreshPending();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {pendingCount > 0 ? (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200">
          未送信 {pendingCount}枚
          <button
            type="button"
            disabled={busy || !online}
            onClick={() => void flushQueue()}
            className="ml-3 underline disabled:opacity-40"
          >
            今すぐ送る
          </button>
        </div>
      ) : null}

      <section className="rounded-3xl bg-white p-4 ring-1 ring-[var(--kb-line)]">
        <label className="flex items-center gap-3 text-base font-medium">
          <input
            type="checkbox"
            checked={useBlackboard}
            onChange={(event) => setUseBlackboard(event.target.checked)}
            className="size-5"
          />
          電子小黒板を焼き付ける
        </label>
        <p className="mt-2 text-sm text-zinc-500">
          黒板の文言はオフラインでも端末に保存されます。電波が弱い現場でも先に編集・撮影できます。
        </p>
        {useBlackboard ? (
          <div className="mt-4 grid gap-3">
            {EDIT_FIELDS.map((key) => (
              <label key={key} className="grid gap-1 text-sm">
                <span className="font-medium text-zinc-600">{BLACKBOARD_FIELD_LABELS[key]}</span>
                {key === "description" || key === "projectName" ? (
                  <textarea
                    className="min-h-20 rounded-2xl border border-[var(--kb-line)] px-3 py-2 text-base"
                    value={board[key]}
                    onChange={(event) => void persistBoard({ ...board, [key]: event.target.value })}
                  />
                ) : (
                  <input
                    className="min-h-12 rounded-2xl border border-[var(--kb-line)] px-3 py-2 text-base"
                    value={board[key]}
                    onChange={(event) => void persistBoard({ ...board, [key]: event.target.value })}
                  />
                )}
              </label>
            ))}
            <div className="overflow-hidden rounded-xl bg-[rgba(40,40,40,0.9)] text-white">
              <div className="grid grid-cols-[4.5rem_1fr] border-b border-white/80 text-sm">
                <div className="border-r border-white/80 px-2 py-2 text-center font-semibold">工事名</div>
                <div className="px-2 py-2">{board.projectName || "　"}</div>
              </div>
              <div className="grid grid-cols-[4.5rem_1fr] border-b border-white/80 text-sm">
                <div className="border-r border-white/80 px-2 py-2 text-center font-semibold">工種</div>
                <div className="px-2 py-2">{board.workType || "　"}</div>
              </div>
              <div className="grid grid-cols-[4.5rem_1fr] border-b border-white/80 text-sm">
                <div className="border-r border-white/80 px-2 py-2 text-center font-semibold">場所</div>
                <div className="px-2 py-2">{board.location || "　"}</div>
              </div>
              <div className="border-b border-white/80 px-3 py-6 text-center text-lg font-bold">
                {board.description || "　"}
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span>{board.date || "　"}</span>
                <span className="text-right">{board.companyName || "　"}</span>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--kb-line)] bg-white px-4 text-center">
        <span className="text-lg font-medium">写真を選ぶ / 撮る</span>
        <span className="mt-1 text-sm text-zinc-500">
          複数枚OK。黒板付きでも端末に先に残せます。
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          capture="environment"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            void onFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {busy || progress ? (
        <p className="text-sm text-zinc-600">
          {progress}
          {done ? `（${done}枚）` : ""}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
