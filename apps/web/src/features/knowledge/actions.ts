"use server";

import { revalidatePath } from "next/cache";
import { MAX_DOCUMENT_BYTES } from "@kensapo/domain";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { formString } from "@/lib/form";
import { documentStoragePath } from "@/lib/storage-paths";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function uploadDocumentAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "knowledge.write") && !can(workspace, "import.manage") && !can(workspace, "project.update")) {
    return { error: "資料を登録する権限がありません。" };
  }
  const title = formString(formData, "title");
  const kind = formString(formData, "kind") || "other";
  const file = formData.get("file");
  if (!title) {
    return { error: "資料名を入力してください。" };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "ファイルを選んでください。" };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { error: "ファイルが大きすぎます。" };
  }
  const allowed = ["application/pdf", "image/jpeg", "image/png", "text/plain"];
  if (file.type && !allowed.includes(file.type)) {
    return { error: "PDF / 画像 / テキストのみです。" };
  }
  const supabase = await createServerSupabaseClient();
  const documentId = crypto.randomUUID();
  const path = documentStoragePath(workspace.organizationId, documentId, file.name);
  const upload = await supabase.storage.from("org-files").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upload.error) {
    return { error: upload.error.message };
  }
  const { error } = await supabase.from("documents").insert({
    id: documentId,
    organization_id: workspace.organizationId,
    title,
    kind,
    description: formString(formData, "description") || null,
    storage_path: path,
    mime_type: file.type || null,
    created_by: workspace.userId,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/knowledge");
  return null;
}
