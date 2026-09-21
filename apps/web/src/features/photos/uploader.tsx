"use client";

import { useEffect, useRef, useState } from "react";

type SelectedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

function revokePreview(url: string) {
  URL.revokeObjectURL(url);
}
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
import { isExistingStorageObject } from "@/features/photos/upload-safety";
import { PhotoUploadNextSteps } from "@/features/photos/upload-next-steps";
import { toUserActionError } from "@/lib/user-error";

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
  canCreateReport = false,
}: {
  organizationId: string;
  projectId: string;
  projectName?: string;
  companyName?: string;
  canCreateReport?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [saved, setSaved] = useState(false);
  const [savedPhotoId, setSavedPhotoId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [useBlackboard, setUseBlackboard] = useState(false);
  const [selected, setSelected] = useState<SelectedPhoto[]>([]);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
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

  useEffect(() => {
    return () => {
      for (const item of selectedRef.current) {
        revokePreview(item.previewUrl);
      }
    };
  }, []);

  async function persistBoard(next: ConstructionBlackboard) {
    setBoard(next);
    await saveBlackboardDraft(organizationId, projectId, next);
  }

  async function uploadPrepared(items: QueuedPhoto[]): Promise<{
    photoId: string | null;
    saved: number;
    failed: number;
  }> {
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
    let lastError: string | null = null;
    const workers = Math.min(3, items.length);
    let cursor = 0;
    async function runWorker() {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        const item = items[index];
        if (!item) {
          return;
        }
        setProgress(`${index + 1} / ${items.length} 枚を送信中`);
        const path = photoStoragePath(organizationId, projectId, item.id, extensionForMime(item.mimeType));
        try {
          const upload = await supabase.storage.from("org-files").upload(path, item.blob, {
            contentType: item.mimeType,
            upsert: false,
          });
          if (upload.error && !isExistingStorageObject(upload.error.message)) {
            lastError = upload.error.message;
            continue;
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
          setDone(registered.length);
        } catch (caught) {
          lastError = caught instanceof Error ? caught.message : "送信に失敗しました";
        }
      }
    }
    await Promise.all(Array.from({ length: workers }, () => runWorker()));
    if (registered.length === 0) {
      throw new Error(lastError ?? "写真を送れませんでした");
    }
    const result = await registerPhotosAction({ projectId, items: registered });
    if ("error" in result) {
      throw new Error(result.error);
    }
    await removeQueuedPhotos(uploadedIds);
    await refreshPending();
    return {
      photoId: result.ids[0] ?? registered[0]?.id ?? null,
      saved: registered.length,
      failed: items.length - registered.length,
    };
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
      const outcome = await uploadPrepared(queued);
      setSavedPhotoId(outcome.photoId);
      setSaved(outcome.saved > 0);
      if (outcome.failed > 0) {
        setError(`${outcome.saved}枚を保存しました。送れなかった${outcome.failed}枚は端末に残します`);
        setProgress(`${outcome.saved}枚を保存しました`);
      } else {
        setProgress(`${outcome.saved}枚の未送信を送りました`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "未送信の再送に失敗しました");
    } finally {
      setBusy(false);
      await refreshPending();
    }
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const incoming = [...fileList];
    const rejected = incoming.some((file) => !isAllowedImageType(file.type));
    if (rejected) {
      setError("JPEG / PNG / WebP のみです。");
    } else {
      setError(null);
    }
    setSelected((current) => {
      const room = MAX_PHOTOS_PER_BATCH - current.length;
      const added = incoming
        .filter((file) => isAllowedImageType(file.type))
        .slice(0, Math.max(0, room))
        .map((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        }));
      return [...current, ...added];
    });
    setSaved(false);
    setSavedPhotoId(null);
  }

  function removeSelected(id: string) {
    setSelected((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        revokePreview(target.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  }

  function clearSelected() {
    setSelected((current) => {
      for (const item of current) {
        revokePreview(item.previewUrl);
      }
      return [];
    });
  }

  async function onFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    setDone(0);
    setSaved(false);
    setSavedPhotoId(null);
    setProgress("アップロード中…");
    try {
      await saveBlackboardDraft(organizationId, projectId, board);
      const prepared: QueuedPhoto[] = [];
      for (const [index, original] of files.entries()) {
        setProgress(`${index + 1} / ${files.length} 枚を準備中`);
        const compressed = await compressImageFile(original);
        const burned = useBlackboard
          ? await burnBlackboardOntoImage(compressed, board)
          : compressed;
        const outputType =
          burned instanceof File
            ? burned.type
            : burned.type || compressed.type || "image/jpeg";
        const mimeType = isAllowedImageType(outputType) ? outputType : "image/jpeg";
        const takenAt = (await readJpegTakenAt(original)) ?? new Date().toISOString();
        prepared.push({
          id: crypto.randomUUID(),
          organizationId,
          projectId,
          fileName: useBlackboard
            ? original.name.replace(/(\.[^.]+)?$/, "-blackboard.jpg")
            : burned instanceof File
              ? burned.name
              : original.name,
          mimeType,
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
        clearSelected();
        return;
      }
      const outcome = await uploadPrepared(prepared);
      setSavedPhotoId(outcome.photoId);
      setSaved(outcome.saved > 0);
      if (outcome.failed > 0) {
        setError(`${outcome.saved}枚を保存しました。送れなかった${outcome.failed}枚は端末に残します`);
        setProgress(`${outcome.saved}枚を保存しました`);
      } else {
        setProgress(`${outcome.saved}枚を保存しました`);
      }
      clearSelected();
    } catch (caught) {
      setError(toUserActionError(caught instanceof Error ? caught.message : null, "写真を保存"));
      setProgress("送れなかった写真は端末に残します");
    } finally {
      setBusy(false);
      await refreshPending();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {pendingCount > 0 ? (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
          未送信 {pendingCount}枚
          <button
            type="button"
            disabled={busy || !online}
            onClick={() => void flushQueue()}
            className="ml-3 min-h-0 underline disabled:opacity-40"
          >
            今すぐ送る
          </button>
        </div>
      ) : null}

      <label className="kb-tap flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--kb-line)] bg-white px-4 text-center">
        <span className="text-lg font-medium">{selected.length > 0 ? "写真を追加する" : "写真を選ぶ"}</span>
        <span className="mt-1 text-sm text-zinc-500">間違えた写真は右上の×で外せます。</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {selected.length > 0 ? (
        <section className="rounded-3xl bg-white p-4 ring-1 ring-[var(--kb-line)]">
          <p className="text-sm font-medium text-zinc-600">{selected.length}枚を選択中</p>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {selected.map((item) => (
              <li key={item.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.previewUrl} alt="" className="h-28 w-full rounded-2xl object-cover" />
                <button
                  type="button"
                  disabled={busy}
                  aria-label="この写真を外す"
                  onClick={() => removeSelected(item.id)}
                  className="absolute right-1.5 top-1.5 flex h-8 w-8 min-h-8 min-w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/70 p-0 text-white shadow-sm disabled:opacity-40 [appearance:none]"
                >
                  <span className="block text-base leading-none" aria-hidden>
                    ×
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onFiles(selected.map((item) => item.file))}
            className="kb-tap mt-4 min-h-12 w-full rounded-2xl bg-[var(--kb-ink)] font-medium text-white disabled:opacity-60"
          >
            {busy ? "アップロード中…" : "この写真を保存"}
          </button>
        </section>
      ) : null}

      <details className="rounded-2xl bg-white px-4 py-3">
        <summary className="kb-tap min-h-12 cursor-pointer list-none text-sm font-medium text-zinc-600">
          {useBlackboard ? "黒板を使っています" : "黒板を付ける（任意）"}
        </summary>
        <label className="mt-3 flex items-center gap-3 text-base">
          <input
            type="checkbox"
            checked={useBlackboard}
            onChange={(event) => setUseBlackboard(event.target.checked)}
            className="size-5"
          />
          写真に黒板を入れる
        </label>
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
          </div>
        ) : null}
      </details>

      {busy || progress ? (
        <p className="text-sm text-zinc-600">
          {progress}
          {done ? `（${done}枚）` : ""}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? (
        <PhotoUploadNextSteps projectId={projectId} canReport={canCreateReport} photoId={savedPhotoId} />
      ) : null}
    </div>
  );
}
