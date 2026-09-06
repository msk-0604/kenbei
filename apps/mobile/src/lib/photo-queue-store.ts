import * as FileSystem from "expo-file-system/legacy";
import {
  recoverStuckUploads,
  type PhotoQueueItem,
} from "./photo-queue-logic";

const ROOT = `${FileSystem.documentDirectory ?? ""}kenbei-photo-queue/`;
const FILES = `${ROOT}files/`;
const INDEX = `${ROOT}queue.json`;
const INDEX_TMP = `${ROOT}queue.json.tmp`;

let memory: PhotoQueueItem[] | null = null;
let writeTail: Promise<void> = Promise.resolve();

function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeTail.then(fn, fn);
  writeTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensureDirs(): Promise<void> {
  const rootInfo = await FileSystem.getInfoAsync(ROOT);
  if (!rootInfo.exists) {
    await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
  }
  const filesInfo = await FileSystem.getInfoAsync(FILES);
  if (!filesInfo.exists) {
    await FileSystem.makeDirectoryAsync(FILES, { intermediates: true });
  }
}

async function persist(items: PhotoQueueItem[]): Promise<void> {
  await ensureDirs();
  const body = JSON.stringify(items);
  await FileSystem.writeAsStringAsync(INDEX_TMP, body);
  const dest = await FileSystem.getInfoAsync(INDEX);
  if (dest.exists) {
    await FileSystem.deleteAsync(INDEX, { idempotent: true });
  }
  await FileSystem.moveAsync({ from: INDEX_TMP, to: INDEX });
  memory = items;
}

export async function loadPhotoQueue(): Promise<PhotoQueueItem[]> {
  await ensureDirs();
  const info = await FileSystem.getInfoAsync(INDEX);
  if (!info.exists) {
    memory = [];
    return [];
  }
  const raw = await FileSystem.readAsStringAsync(INDEX);
  let parsed: PhotoQueueItem[] = [];
  try {
    parsed = JSON.parse(raw) as PhotoQueueItem[];
    if (!Array.isArray(parsed)) {
      parsed = [];
    }
  } catch {
    parsed = [];
  }
  const recovered = recoverStuckUploads(parsed);
  if (JSON.stringify(recovered) !== JSON.stringify(parsed)) {
    await persist(recovered);
  } else {
    memory = recovered;
  }
  return recovered;
}

export async function getPhotoQueue(): Promise<PhotoQueueItem[]> {
  if (memory) {
    return memory;
  }
  return loadPhotoQueue();
}

export async function savePhotoQueue(items: PhotoQueueItem[]): Promise<PhotoQueueItem[]> {
  return enqueueWrite(async () => {
    await persist(items);
    return items;
  });
}

export async function updateQueueItem(
  localId: string,
  patch: (item: PhotoQueueItem) => PhotoQueueItem,
): Promise<PhotoQueueItem | null> {
  return enqueueWrite(async () => {
    const items = memory ? [...memory] : await loadPhotoQueue();
    const index = items.findIndex((row) => row.localId === localId);
    if (index < 0) {
      return null;
    }
    const current = items[index];
    if (!current) {
      return null;
    }
    const next = patch(current);
    items[index] = next;
    await persist(items);
    return next;
  });
}

export async function appendQueueItem(item: PhotoQueueItem): Promise<PhotoQueueItem[]> {
  return enqueueWrite(async () => {
    const items = memory ? [...memory] : await loadPhotoQueue();
    items.unshift(item);
    await persist(items);
    return items;
  });
}

export async function removeQueueItem(localId: string): Promise<void> {
  await enqueueWrite(async () => {
    const items = memory ? [...memory] : await loadPhotoQueue();
    await persist(items.filter((row) => row.localId !== localId));
  });
}

export function queueFilePath(localId: string): string {
  return `${FILES}${localId}.jpg`;
}

export async function copyIntoQueue(sourceUri: string, localId: string): Promise<string> {
  await ensureDirs();
  const dest = queueFilePath(localId);
  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  }
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function deleteQueueFile(localId: string): Promise<void> {
  await FileSystem.deleteAsync(queueFilePath(localId), { idempotent: true });
}

export async function readQueueFileInfo(uri: string): Promise<{ size: number; exists: boolean }> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) {
    return { size: 0, exists: false };
  }
  return { size: "size" in info && typeof info.size === "number" ? info.size : 0, exists: true };
}
