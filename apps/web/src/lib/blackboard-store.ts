import {
  emptyBlackboard,
  type ConstructionBlackboard,
} from "@kensapo/domain";

const DB_NAME = "kenbei-blackboard";
const STORE = "boards";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("blackboard db open failed"));
  });
}

function boardKey(organizationId: string, projectId: string): string {
  return `${organizationId}:${projectId}`;
}

export async function loadBlackboardDraft(
  organizationId: string,
  projectId: string,
): Promise<ConstructionBlackboard> {
  const db = await openDb();
  const row = await new Promise<{ board: ConstructionBlackboard } | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(boardKey(organizationId, projectId));
    req.onsuccess = () => resolve(req.result as { board: ConstructionBlackboard } | undefined);
    req.onerror = () => reject(req.error ?? new Error("load failed"));
  });
  db.close();
  return emptyBlackboard(row?.board);
}

export async function saveBlackboardDraft(
  organizationId: string,
  projectId: string,
  board: ConstructionBlackboard,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ key: boardKey(organizationId, projectId), board });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("save failed"));
  });
  db.close();
}
