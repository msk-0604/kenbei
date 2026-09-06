import { PHOTO_BUCKET, PHOTO_QUEUE } from "./photo-settings";
import { extensionForMime, photoStoragePath } from "./storage-paths";
import { isDuplicateStorageError, type PhotoQueueItem } from "./photo-queue-logic";
import { supabase } from "./supabase";

export async function uploadQueuedPhoto(item: PhotoQueueItem): Promise<{ storagePath: string }> {
  const file = await fetch(item.localFileUri);
  if (!file.ok) {
    throw new Error("ローカル写真を読めません。再撮影してください。");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("写真ファイルが空です。");
  }
  if (bytes.byteLength > PHOTO_QUEUE.maxUploadBytes) {
    throw new Error("写真が大きすぎます。圧縮後も上限を超えています。");
  }

  const ext = extensionForMime(item.mimeType);
  const storagePath =
    item.storagePath ?? photoStoragePath(item.organizationId, item.projectId, item.localId, ext);

  const upload = await supabase.storage.from(PHOTO_BUCKET).upload(storagePath, bytes, {
    contentType: item.mimeType,
    upsert: false,
  });
  if (upload.error && !isDuplicateStorageError(upload.error.message)) {
    throw new Error(upload.error.message);
  }

  const insert = await supabase.from("photos").insert({
    id: item.localId,
    organization_id: item.organizationId,
    project_id: item.projectId,
    captured_by: item.capturedBy,
    taken_at: item.capturedAt,
    storage_path: storagePath,
    original_filename: item.filename,
    classification_status: "none",
    tags: [],
    proposed_tags: [],
  });
  if (insert.error && !isDuplicateStorageError(insert.error.message) && insert.error.code !== "23505") {
    throw new Error(insert.error.message);
  }

  return { storagePath };
}
