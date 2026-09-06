import * as Network from "expo-network";
import {
  markFailed,
  markSynced,
  markUploading,
  nextFlushTarget,
  resetForManualRetry,
  type PhotoQueueItem,
} from "./photo-queue-logic";
import {
  deleteQueueFile,
  getPhotoQueue,
  loadPhotoQueue,
  removeQueueItem,
  updateQueueItem,
} from "./photo-queue-store";
import { uploadQueuedPhoto } from "./photo-upload";

type Listener = (items: PhotoQueueItem[]) => void;

const listeners = new Set<Listener>();
let flushing = false;

function emit(items: PhotoQueueItem[]): void {
  for (const listener of listeners) {
    listener(items);
  }
}

export function subscribePhotoQueue(listener: Listener): () => void {
  listeners.add(listener);
  void getPhotoQueue().then(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function refreshPhotoQueue(): Promise<PhotoQueueItem[]> {
  const items = await loadPhotoQueue();
  emit(items);
  return items;
}

export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.isConnected === false) {
      return false;
    }
    if (state.isInternetReachable === false) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export async function flushPhotoQueue(): Promise<void> {
  if (flushing) {
    return;
  }
  flushing = true;
  try {
    while (await isOnline()) {
      const items = await getPhotoQueue();
      const target = nextFlushTarget(items, Date.now());
      if (!target) {
        break;
      }
      await uploadOne(target);
    }
  } finally {
    flushing = false;
    emit(await getPhotoQueue());
  }
}

async function uploadOne(item: PhotoQueueItem): Promise<void> {
  const started = await updateQueueItem(item.localId, (row) => markUploading(row, Date.now()));
  if (started) {
    emit(await getPhotoQueue());
  }
  await updateQueueItem(item.localId, (row) => ({ ...row, progress: 40 }));
  try {
    await updateQueueItem(item.localId, (row) => ({ ...row, progress: 70 }));
    const { storagePath } = await uploadQueuedPhoto(item);
    const synced = await updateQueueItem(item.localId, (row) =>
      markSynced(row, storagePath, new Date().toISOString()),
    );
    if (synced?.status === "synced") {
      await deleteQueueFile(item.localId);
      await removeQueueItem(item.localId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "アップロードに失敗しました。";
    await updateQueueItem(item.localId, (row) => markFailed(row, message, Date.now()));
  }
  emit(await getPhotoQueue());
}

export async function retryPhoto(localId: string): Promise<void> {
  await updateQueueItem(localId, resetForManualRetry);
  emit(await getPhotoQueue());
  void flushPhotoQueue();
}

export async function retryAllFailed(): Promise<void> {
  const items = await getPhotoQueue();
  for (const item of items.filter((row) => row.status === "failed")) {
    await updateQueueItem(item.localId, resetForManualRetry);
  }
  emit(await getPhotoQueue());
  void flushPhotoQueue();
}
