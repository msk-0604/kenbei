import { describe, expect, it } from "vitest";
import { photoStoragePath, extensionForMime, isAllowedImageMime } from "./storage-paths";
import {
  canAutoRetry,
  isDuplicateStorageError,
  markFailed,
  markSynced,
  nextFlushTarget,
  recoverStuckUploads,
  resetForManualRetry,
  retryDelayMs,
  unsyncedCount,
  type PhotoQueueItem,
} from "./photo-queue-logic";

function item(partial: Partial<PhotoQueueItem>): PhotoQueueItem {
  return {
    localId: "id-1",
    localFileUri: "file:///tmp/a.jpg",
    organizationId: "org",
    projectId: "proj",
    projectName: "現場A",
    capturedBy: "user",
    capturedByName: "監督",
    capturedAt: "2026-09-04T08:00:00.000Z",
    createdAt: "2026-09-04T08:00:00.000Z",
    filename: "a.jpg",
    mimeType: "image/jpeg",
    size: 1000,
    width: 100,
    height: 80,
    status: "pending",
    progress: 0,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
    uploadedAt: null,
    remoteId: null,
    storagePath: null,
    lat: null,
    lng: null,
    ...partial,
  };
}

describe("storage paths", () => {
  it("scopes photos under org/project", () => {
    expect(photoStoragePath("org-1", "proj-2", "photo-3", "jpg")).toBe(
      "org-1/projects/proj-2/photos/photo-3.jpg",
    );
  });

  it("maps mime to extension", () => {
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(isAllowedImageMime("image/png")).toBe(true);
    expect(isAllowedImageMime("application/pdf")).toBe(false);
  });
});

describe("photo queue logic", () => {
  it("recovers crash-stuck uploading rows without deleting files", () => {
    const recovered = recoverStuckUploads([item({ status: "uploading", progress: 40 })]);
    expect(recovered[0]?.status).toBe("pending");
    expect(recovered[0]?.localFileUri).toBe("file:///tmp/a.jpg");
  });

  it("uses exponential backoff and caps auto retry", () => {
    expect(retryDelayMs(0)).toBe(1000);
    expect(retryDelayMs(3)).toBe(8000);
    expect(retryDelayMs(20)).toBe(5 * 60 * 1000);
    const failed = item({ status: "failed", retryCount: 8, lastAttemptAt: 0 });
    expect(canAutoRetry(failed, Date.now())).toBe(false);
  });

  it("allows manual retry after auto-retry is exhausted", () => {
    const failed = item({ status: "failed", retryCount: 8, lastError: "network" });
    expect(resetForManualRetry(failed)).toMatchObject({ status: "pending", retryCount: 0, lastError: null });
  });

  it("keeps failed photos in the queue", () => {
    const failed = markFailed(item({ status: "uploading" }), "offline", 1);
    expect(failed.status).toBe("failed");
    expect(failed.localFileUri).toContain("a.jpg");
    expect(unsyncedCount([failed])).toBe(1);
  });

  it("marks synced only with storage path", () => {
    const synced = markSynced(item({}), "org/projects/p/photos/id.jpg", "2026-09-04T09:00:00.000Z");
    expect(synced.status).toBe("synced");
    expect(synced.progress).toBe(100);
  });

  it("flushes pending before waiting failed", () => {
    const pending = item({ localId: "p" });
    const failed = item({
      localId: "f",
      status: "failed",
      retryCount: 1,
      lastAttemptAt: Date.now(),
    });
    expect(nextFlushTarget([failed, pending], Date.now())?.localId).toBe("p");
  });

  it("treats duplicate storage as already uploaded", () => {
    expect(isDuplicateStorageError("The resource already exists")).toBe(true);
  });
});
