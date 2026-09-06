import * as ImagePicker from "expo-image-picker";
import { parseExifDate, readJpegTakenAtFromBuffer } from "./exif";
import { compressPhoto } from "./photo-compress";
import { PHOTO_QUEUE } from "./photo-settings";
import { isAllowedImageMime } from "./storage-paths";
import { appendQueueItem, copyIntoQueue, readQueueFileInfo } from "./photo-queue-store";
import { flushPhotoQueue } from "./photo-queue";
import type { PhotoQueueItem } from "./photo-queue-logic";

export type CaptureSource = "camera" | "library";

export type CaptureFailure = {
  ok: false;
  reason: "canceled" | "permission" | "unavailable" | "invalid";
  message: string;
};

export type CapturedAsset = {
  uri: string;
  width: number;
  height: number;
  takenAt: string;
  filename: string;
  mimeType: string;
};

function newId(): string {
  return crypto.randomUUID();
}

function takenAtFromAsset(asset: ImagePicker.ImagePickerAsset): string {
  const exifValue = asset.exif?.DateTimeOriginal ?? asset.exif?.DateTimeDigitized ?? asset.exif?.DateTime;
  if (typeof exifValue === "string") {
    const parsed = parseExifDate(exifValue.replace("T", " ").replace(/-/g, ":"));
    if (parsed) {
      return parsed;
    }
    const fromColon = parseExifDate(exifValue);
    if (fromColon) {
      return fromColon;
    }
  }
  return new Date().toISOString();
}

async function takenAtWithJpegFallback(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const fromExif = takenAtFromAsset(asset);
  if (fromExif) {
    try {
      const response = await fetch(asset.uri);
      const buffer = await response.arrayBuffer();
      const jpeg = readJpegTakenAtFromBuffer(buffer.slice(0, 128 * 1024));
      return jpeg ?? fromExif;
    } catch {
      return fromExif;
    }
  }
  return new Date().toISOString();
}

async function ensureCameraPermission(): Promise<CaptureFailure | null> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  const status = current.granted
    ? current
    : await ImagePicker.requestCameraPermissionsAsync();
  if (status.granted) {
    return null;
  }
  return {
    ok: false,
    reason: "permission",
    message: "カメラの許可がありません。設定から許可してください。",
  };
}

async function ensureLibraryPermission(): Promise<CaptureFailure | null> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  const status = current.granted
    ? current
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status.granted) {
    return null;
  }
  return {
    ok: false,
    reason: "permission",
    message: "写真ライブラリの許可がありません。設定から許可してください。",
  };
}

export async function takePhoto(): Promise<CapturedAsset | CaptureFailure> {
  try {
    const denied = await ensureCameraPermission();
    if (denied) {
      return denied;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 1,
      exif: true,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) {
      return { ok: false, reason: "canceled", message: "" };
    }
    return mapAsset(result.assets[0]);
  } catch (error) {
    return {
      ok: false,
      reason: "unavailable",
      message: error instanceof Error ? error.message : "カメラを起動できませんでした。",
    };
  }
}

export async function pickFromLibrary(): Promise<CapturedAsset[] | CaptureFailure> {
  try {
    const denied = await ensureLibraryPermission();
    if (denied) {
      return denied;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      exif: true,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: PHOTO_QUEUE.maxLibrarySelection,
    });
    if (result.canceled || result.assets.length === 0) {
      return { ok: false, reason: "canceled", message: "" };
    }
    const mapped: CapturedAsset[] = [];
    for (const asset of result.assets) {
      mapped.push(await mapAsset(asset));
    }
    return mapped;
  } catch (error) {
    return {
      ok: false,
      reason: "unavailable",
      message: error instanceof Error ? error.message : "ライブラリを開けませんでした。",
    };
  }
}

async function mapAsset(asset: ImagePicker.ImagePickerAsset): Promise<CapturedAsset> {
  const mime = asset.mimeType && isAllowedImageMime(asset.mimeType) ? asset.mimeType : "image/jpeg";
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    takenAt: await takenAtWithJpegFallback(asset),
    filename: asset.fileName ?? `kenbei-${Date.now()}.jpg`,
    mimeType: mime,
  };
}

export async function enqueueCapturedPhotos(input: {
  assets: CapturedAsset[];
  organizationId: string;
  projectId: string;
  projectName: string;
  userId: string;
  displayName: string;
}): Promise<{ saved: number; errors: string[] }> {
  const errors: string[] = [];
  let saved = 0;
  for (const asset of input.assets) {
    try {
      const compressed = await compressPhoto(asset.uri);
      const localId = newId();
      const localFileUri = await copyIntoQueue(compressed.uri, localId);
      const info = await readQueueFileInfo(localFileUri);
      if (!info.exists) {
        throw new Error("端末への保存に失敗しました。");
      }
      const row: PhotoQueueItem = {
        localId,
        localFileUri,
        organizationId: input.organizationId,
        projectId: input.projectId,
        projectName: input.projectName,
        capturedBy: input.userId,
        capturedByName: input.displayName,
        capturedAt: asset.takenAt,
        createdAt: new Date().toISOString(),
        filename: asset.filename.replace(/\.[^.]+$/, ".jpg"),
        mimeType: compressed.mimeType,
        size: info.size,
        width: compressed.width,
        height: compressed.height,
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
      };
      await appendQueueItem(row);
      saved += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "保存に失敗しました。");
    }
  }
  void flushPhotoQueue();
  return { saved, errors };
}

export function isCaptureFailure(value: CapturedAsset[] | CapturedAsset | CaptureFailure): value is CaptureFailure {
  return "ok" in value && value.ok === false;
}
