import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function signedPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) {
    return map;
  }
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
