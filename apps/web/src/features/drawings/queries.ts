import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { currentOrganizationId } from "@/lib/org-scope";

export type ProjectDrawing = {
  id: string;
  seriesId: string;
  title: string;
  drawingKind: string | null;
  version: number;
  isLatest: boolean;
  createdAt: string;
  url: string | null;
  versions: { id: string; version: number; url: string | null }[];
};

export async function listProjectDrawings(projectId: string): Promise<ProjectDrawing[]> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, series_id, title, drawing_kind, version, is_latest, storage_path, created_at")
    .eq("project_id", projectId)
    .eq("organization_id", organizationId)
    .eq("category", "drawing")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  type Row = {
    id: string;
    series_id: string;
    title: string;
    drawing_kind: string | null;
    version: number;
    is_latest: boolean;
    storage_path: string;
    created_at: string;
  };
  const rows = (data as Row[] | null) ?? [];
  const signed =
    rows.length === 0
      ? { data: [] }
      : await supabase.storage.from("org-files").createSignedUrls(
          rows.map((row) => row.storage_path),
          60 * 60,
        );
  const urlByPath = new Map(
    (signed.data ?? [])
      .filter((item) => item.path && item.signedUrl)
      .map((item) => [item.path as string, item.signedUrl as string]),
  );
  const grouped = new Map<string, ProjectDrawing>();
  for (const row of rows) {
    const url = urlByPath.get(row.storage_path) ?? null;
    const current = grouped.get(row.series_id);
    const versionItem = { id: row.id, version: row.version, url };
    if (!current) {
      grouped.set(row.series_id, {
        id: row.id,
        seriesId: row.series_id,
        title: row.title,
        drawingKind: row.drawing_kind,
        version: row.version,
        isLatest: row.is_latest,
        createdAt: row.created_at,
        url,
        versions: [versionItem],
      });
      continue;
    }
    current.versions.push(versionItem);
    if (row.is_latest || row.version > current.version) {
      current.id = row.id;
      current.title = row.title;
      current.drawingKind = row.drawing_kind;
      current.version = row.version;
      current.isLatest = row.is_latest;
      current.createdAt = row.created_at;
      current.url = url;
    }
  }
  return [...grouped.values()].map((item) => ({
    ...item,
    versions: item.versions.sort((a, b) => b.version - a.version),
  }));
}
