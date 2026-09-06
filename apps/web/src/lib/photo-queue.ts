const DB_NAME = "kenbei-photo-queue";
const STORE = "photos";

export type QueuedPhoto = {
  id: string;
  organizationId: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  takenAt: string;
  blob: Blob;
  createdAt: number;
  comment?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB open failed"));
  });
}

export async function enqueuePhotos(items: QueuedPhoto[]): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("enqueue failed"));
  });
  db.close();
}

export async function listQueuedPhotos(projectId?: string): Promise<QueuedPhoto[]> {
  const db = await openDb();
  const rows = await new Promise<QueuedPhoto[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as QueuedPhoto[]) ?? []);
    request.onerror = () => reject(request.error ?? new Error("list failed"));
  });
  db.close();
  return projectId ? rows.filter((row) => row.projectId === projectId) : rows;
}

export async function removeQueuedPhotos(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const id of ids) {
      store.delete(id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("remove failed"));
  });
  db.close();
}

export async function countQueuedPhotos(): Promise<number> {
  const rows = await listQueuedPhotos();
  return rows.length;
}
