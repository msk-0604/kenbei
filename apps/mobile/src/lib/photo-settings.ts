/** Construction photos: keep text/detail readable. Tune here, not in capture UI. */
export const PHOTO_COMPRESS = {
  maxEdge: 1920,
  quality: 0.8,
  retryQuality: 0.62,
  outputMime: "image/jpeg",
} as const;

export const PHOTO_QUEUE = {
  maxAutoRetries: 8,
  maxBackoffMs: 5 * 60 * 1000,
  pageSize: 24,
  maxLibrarySelection: 20,
  maxUploadBytes: 8 * 1024 * 1024,
} as const;

export const PHOTO_BUCKET = "org-files";
