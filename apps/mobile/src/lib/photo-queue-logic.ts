import { PHOTO_QUEUE } from "./photo-settings";

export type QueueStatus = "pending" | "uploading" | "synced" | "failed";

export type PhotoQueueItem = {
  localId: string;
  localFileUri: string;
  organizationId: string;
  projectId: string;
  projectName: string;
  capturedBy: string;
  capturedByName: string;
  capturedAt: string;
  createdAt: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  status: QueueStatus;
  progress: number;
  retryCount: number;
  lastError: string | null;
  lastAttemptAt: number | null;
  uploadedAt: string | null;
  remoteId: string | null;
  storagePath: string | null;
  lat: number | null;
  lng: number | null;
};

export const PHOTO_QUEUE_MAX_AUTO_RETRIES = PHOTO_QUEUE.maxAutoRetries;
export const PHOTO_QUEUE_MAX_BACKOFF_MS = PHOTO_QUEUE.maxBackoffMs;

export function retryDelayMs(retryCount: number): number {
  const exp = Math.min(PHOTO_QUEUE_MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, retryCount));
  return exp;
}

export function recoverStuckUploads(items: PhotoQueueItem[]): PhotoQueueItem[] {
  return items.map((item) =>
    item.status === "uploading"
      ? { ...item, status: "pending", progress: 0, lastError: item.lastError }
      : item,
  );
}

export function canAutoRetry(item: PhotoQueueItem, now: number): boolean {
  if (item.status === "pending") {
    return true;
  }
  if (item.status !== "failed") {
    return false;
  }
  if (item.retryCount >= PHOTO_QUEUE_MAX_AUTO_RETRIES) {
    return false;
  }
  const last = item.lastAttemptAt ?? 0;
  return now - last >= retryDelayMs(item.retryCount);
}

export function markUploading(item: PhotoQueueItem, now: number): PhotoQueueItem {
  return {
    ...item,
    status: "uploading",
    progress: Math.max(item.progress, 10),
    lastAttemptAt: now,
  };
}

export function markFailed(item: PhotoQueueItem, error: string, now: number): PhotoQueueItem {
  return {
    ...item,
    status: "failed",
    progress: 0,
    retryCount: item.retryCount + 1,
    lastError: error,
    lastAttemptAt: now,
  };
}

export function markSynced(item: PhotoQueueItem, storagePath: string, nowIso: string): PhotoQueueItem {
  return {
    ...item,
    status: "synced",
    progress: 100,
    lastError: null,
    uploadedAt: nowIso,
    remoteId: item.localId,
    storagePath,
  };
}

export function resetForManualRetry(item: PhotoQueueItem): PhotoQueueItem {
  return {
    ...item,
    status: "pending",
    progress: 0,
    lastError: null,
    retryCount: 0,
  };
}

export function nextFlushTarget(items: PhotoQueueItem[], now: number): PhotoQueueItem | null {
  return items.find((item) => canAutoRetry(item, now)) ?? null;
}

export function unsyncedCount(items: PhotoQueueItem[]): number {
  return items.filter((item) => item.status !== "synced").length;
}

export function isDuplicateStorageError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("duplicate") ||
    lower.includes("already exists") ||
    lower.includes("resource already exists") ||
    lower.includes("the resource already exists")
  );
}
