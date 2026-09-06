import { Image } from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { PHOTO_COMPRESS, PHOTO_QUEUE } from "./photo-settings";

function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error instanceof Error ? error : new Error("image size failed")),
    );
  });
}

export type CompressedPhoto = {
  uri: string;
  width: number;
  height: number;
  mimeType: "image/jpeg";
};

export async function compressPhoto(uri: string): Promise<CompressedPhoto> {
  const original = await imageSize(uri);
  const longEdge = Math.max(original.width, original.height);
  const scale = longEdge > PHOTO_COMPRESS.maxEdge ? PHOTO_COMPRESS.maxEdge / longEdge : 1;
  const width = Math.max(1, Math.round(original.width * scale));
  const height = Math.max(1, Math.round(original.height * scale));
  const actions =
    scale < 1
      ? [{ resize: { width, height } }]
      : [];
  const first = await manipulateAsync(uri, actions, {
    compress: PHOTO_COMPRESS.quality,
    format: SaveFormat.JPEG,
  });
  let result = first;
  const firstInfo = await imageSize(first.uri);
  const approxBytes = await estimateBytes(first.uri);
  if (approxBytes > PHOTO_QUEUE.maxUploadBytes) {
    result = await manipulateAsync(first.uri, [], {
      compress: PHOTO_COMPRESS.retryQuality,
      format: SaveFormat.JPEG,
    });
  }
  const size = await imageSize(result.uri);
  return {
    uri: result.uri,
    width: size.width || firstInfo.width,
    height: size.height || firstInfo.height,
    mimeType: "image/jpeg",
  };
}

async function estimateBytes(uri: string): Promise<number> {
  try {
    const response = await fetch(uri);
    const buffer = await response.arrayBuffer();
    return buffer.byteLength;
  } catch {
    return 0;
  }
}
