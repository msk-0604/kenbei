export function photoStoragePath(organizationId: string, projectId: string, photoId: string, ext: string): string {
  return `${organizationId}/projects/${projectId}/photos/${photoId}.${ext}`;
}

export function drawingStoragePath(
  organizationId: string,
  projectId: string,
  seriesId: string,
  drawingId: string,
): string {
  return `${organizationId}/projects/${projectId}/drawings/${seriesId}/${drawingId}.pdf`;
}

export function documentStoragePath(organizationId: string, documentId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${organizationId}/documents/${documentId}/${safe}`;
}

export function logoStoragePath(organizationId: string, fileName: string): string {
  const ext = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : "png";
  const safeExt = ext === "jpg" || ext === "jpeg" || ext === "webp" || ext === "png" ? ext : "png";
  return `${organizationId}/branding/logo.${safeExt}`;
}

export function extensionForMime(mime: string): string {
  if (mime === "image/png") {
    return "png";
  }
  if (mime === "image/webp") {
    return "webp";
  }
  return "jpg";
}
