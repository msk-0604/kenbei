import { PHOTO_BUCKET } from "./photo-settings";
import { supabase } from "./supabase";

export async function signedPhotoUrl(
  storagePath: string,
  transform?: { width: number },
): Promise<string | null> {
  if (transform) {
    const transformed = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(storagePath, 60 * 60, {
      transform: { width: transform.width, resize: "contain" },
    });
    if (!transformed.error && transformed.data?.signedUrl) {
      return transformed.data.signedUrl;
    }
  }
  const plain = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(storagePath, 60 * 60);
  return plain.data?.signedUrl ?? null;
}

export async function signedPhotoUrls(
  paths: string[],
  transform?: { width: number },
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(
    paths.map(async (path) => {
      const url = await signedPhotoUrl(path, transform);
      if (url) {
        map.set(path, url);
      }
    }),
  );
  return map;
}
