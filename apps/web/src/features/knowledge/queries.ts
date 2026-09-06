import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type KnowledgeDoc = {
  id: string;
  title: string;
  kind: string;
  description: string | null;
  mimeType: string | null;
  createdAt: string;
  url: string | null;
};

export async function listCompanyDocuments(): Promise<KnowledgeDoc[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, kind, description, mime_type, storage_path, created_at")
    .is("project_id", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  type Row = {
    id: string;
    title: string;
    kind: string;
    description: string | null;
    mime_type: string | null;
    storage_path: string;
    created_at: string;
  };
  const rows = (data as Row[] | null) ?? [];
  const paths = rows.map((row) => row.storage_path);
  const signed =
    paths.length === 0
      ? { data: [] }
      : await supabase.storage.from("org-files").createSignedUrls(paths, 60 * 60);
  const urlByPath = new Map(
    (signed.data ?? [])
      .filter((item) => item.path && item.signedUrl)
      .map((item) => [item.path as string, item.signedUrl as string]),
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    description: row.description,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    url: urlByPath.get(row.storage_path) ?? null,
  }));
}

export async function listProjectDocuments(projectId: string): Promise<KnowledgeDoc[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, kind, description, mime_type, storage_path, created_at")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  type Row = {
    id: string;
    title: string;
    kind: string;
    description: string | null;
    mime_type: string | null;
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
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    description: row.description,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    url: urlByPath.get(row.storage_path) ?? null,
  }));
}

export type KnowledgeHit = {
  id: string;
  title: string;
  snippet: string;
  href: string;
};

export async function searchCompanyKnowledge(query: string): Promise<KnowledgeHit[]> {
  const safe = query.replace(/[%_,.()]/g, " ").replace(/\s+/g, " ").trim();
  if (!safe) {
    return [];
  }
  const supabase = await createServerSupabaseClient();
  const [docs, entries] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, description")
      .is("project_id", null)
      .is("deleted_at", null)
      .or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
      .limit(10),
    supabase
      .from("knowledge_entries")
      .select("id, title, body")
      .is("deleted_at", null)
      .or(`title.ilike.%${safe}%,body.ilike.%${safe}%`)
      .limit(10),
  ]);
  const hits: KnowledgeHit[] = [];
  for (const row of (docs.data as { id: string; title: string; description: string | null }[] | null) ?? []) {
    hits.push({
      id: row.id,
      title: row.title,
      snippet: row.description ?? "会社資料",
      href: "/knowledge",
    });
  }
  for (const row of (entries.data as { id: string; title: string | null; body: string }[] | null) ?? []) {
    hits.push({
      id: row.id,
      title: row.title || "社内知識",
      snippet: row.body.slice(0, 120),
      href: "/knowledge",
    });
  }
  return hits;
}
