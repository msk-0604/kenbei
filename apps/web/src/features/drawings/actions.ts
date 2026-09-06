"use server";

import { revalidatePath } from "next/cache";
import { isDrawingKind, MAX_DOCUMENT_BYTES, nextDrawingVersion } from "@kensapo/domain";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { formString } from "@/lib/form";
import { drawingStoragePath } from "@/lib/storage-paths";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function uploadProjectDrawingAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "project.update") && !can(workspace, "import.manage")) {
    return { error: "図面を登録する権限がありません。" };
  }
  const projectId = formString(formData, "projectId");
  const title = formString(formData, "title");
  const drawingKind = formString(formData, "drawingKind") || "other";
  const seriesIdInput = formString(formData, "seriesId");
  const file = formData.get("file");
  if (!projectId || !title) {
    return { error: "図面名を入力してください。" };
  }
  if (!isDrawingKind(drawingKind)) {
    return { error: "分類を選んでください。" };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "PDFを選んでください。" };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { error: "ファイルが大きすぎます。" };
  }
  if (file.type && file.type !== "application/pdf") {
    return { error: "PDFのみ登録できます。" };
  }
  const supabase = await createServerSupabaseClient();
  const project = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", workspace.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project.data) {
    return { error: "この現場を開けません。" };
  }

  let latest: { id: string; version: number; seriesId: string } | null = null;
  if (seriesIdInput) {
    const existing = await supabase
      .from("documents")
      .select("id, version, series_id")
      .eq("organization_id", workspace.organizationId)
      .eq("project_id", projectId)
      .eq("series_id", seriesIdInput)
      .eq("category", "drawing")
      .eq("is_latest", true)
      .is("deleted_at", null)
      .maybeSingle();
    const row = existing.data as { id: string; version: number; series_id: string } | null;
    if (row) {
      latest = { id: row.id, version: row.version, seriesId: row.series_id };
    }
  }
  const plan = nextDrawingVersion(latest);
  const drawingId = crypto.randomUUID();
  const seriesId = plan.seriesId ?? drawingId;
  const path = drawingStoragePath(workspace.organizationId, projectId, seriesId, drawingId);
  const upload = await supabase.storage.from("org-files").upload(path, file, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upload.error) {
    return { error: upload.error.message };
  }
  if (plan.markPreviousLatestFalse && latest) {
    const { error } = await supabase
      .from("documents")
      .update({ is_latest: false })
      .eq("id", latest.id)
      .eq("organization_id", workspace.organizationId);
    if (error) {
      return { error: error.message };
    }
  }
  const { error } = await supabase.from("documents").insert({
    id: drawingId,
    organization_id: workspace.organizationId,
    project_id: projectId,
    title,
    kind: "other",
    category: "drawing",
    drawing_kind: drawingKind,
    version: plan.version,
    is_latest: true,
    series_id: seriesId,
    supersedes_id: plan.supersedesId,
    storage_path: path,
    mime_type: "application/pdf",
    file_name: file.name,
    file_size_bytes: file.size,
    created_by: workspace.userId,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/projects/${projectId}`);
  return null;
}
