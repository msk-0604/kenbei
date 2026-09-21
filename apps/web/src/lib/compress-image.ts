export const COMPRESS_MAX_EDGE = 1400;
export const COMPRESS_QUALITY = 0.7;
export const COMPRESS_SKIP_UNDER_BYTES = 380_000;

export async function decodeOrientedImageBitmap(source: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(source, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    return await createImageBitmap(source);
  }
}

export async function compressImageFile(
  file: File,
  maxEdge = COMPRESS_MAX_EDGE,
  quality = COMPRESS_QUALITY,
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }
  if (file.type === "image/jpeg" && file.size > 0 && file.size <= COMPRESS_SKIP_UNDER_BYTES) {
    return file;
  }
  const bitmap = await decodeOrientedImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), "image/jpeg", quality);
  });
  if (!blob) {
    return file;
  }
  if (blob.size >= file.size) {
    return file;
  }
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}
