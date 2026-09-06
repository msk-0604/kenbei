export function photoStoragePath(
  organizationId: string,
  projectId: string,
  photoId: string,
  ext: string,
): string {
  return `${organizationId}/projects/${projectId}/photos/${photoId}.${ext}`;
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

export function isAllowedImageMime(value: string): boolean {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}
