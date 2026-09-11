import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PhotoTransform = {
  width: number;
  height?: number;
  resize?: "cover" | "contain" | "fill";
  quality?: number;
};

async function signedOriginalUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.storage.from("org-files").createSignedUrls(paths, 60 * 60);
  if (error || !data) {
    return map;
  }
  for (const item of data) {
    if (item.path && item.signedUrl) {
      map.set(item.path, item.signedUrl);
    }
  }
  return map;
}

export async function signedPhotoUrls(
  paths: string[],
  transform?: PhotoTransform,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) {
    return map;
  }
  if (!transform) {
    return signedOriginalUrls(paths);
  }

  const supabase = await createServerSupabaseClient();
  await Promise.all(
    paths.map(async (path) => {
      const transformed = await supabase.storage.from("org-files").createSignedUrl(path, 60 * 30, {
        transform: {
          width: transform.width,
          height: transform.height,
          resize: transform.resize ?? "cover",
          quality: transform.quality ?? 60,
        },
      });
      if (!transformed.error && transformed.data?.signedUrl) {
        map.set(path, transformed.data.signedUrl);
      }
    }),
  );
  if (map.size === paths.length) {
    return map;
  }
  const missing = paths.filter((path) => !map.has(path));
  const originals = await signedOriginalUrls(missing);
  for (const [path, url] of originals) {
    map.set(path, url);
  }
  return map;
}
