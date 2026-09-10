"use server";

import { revalidatePath } from "next/cache";
import {
  isAllowedImageType,
  MAX_PHOTOS_PER_BATCH,
} from "@kensapo/domain";
import type { PhotoClassification } from "@kensapo/ai";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { formString } from "@/lib/form";
import { consumeRateLimit, RATE_LIMIT_UNAVAILABLE_MESSAGE } from "@/lib/rate-limit";
import { getAiService } from "@/lib/engines";
import { listMemberProfileIdsWithPermission, notifyWorkspaceMembers } from "@/lib/notifications";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type RegisteredPhotoItem = {
  id: string;
  storagePath: string;
  takenAt: string;
  originalFilename: string;
  mimeType: string;
  comment?: string;
};

export async function registerPhotosAction(input: {
  projectId: string;
  items: RegisteredPhotoItem[];
}): Promise<{ error: string } | { ids: string[] }> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "photo.create")) {
    return { error: "写真を登録する権限がありません。" };
  }
  const limit = await consumeRateLimit(`photo:${workspace.userId}`, 40, 60_000);
  if (!limit.allowed) {
    return {
      error: limit.reason === "unavailable" ? RATE_LIMIT_UNAVAILABLE_MESSAGE : "アップロードが多すぎます。少し待ってください。",
    };
  }
  if (input.items.length === 0 || input.items.length > MAX_PHOTOS_PER_BATCH) {
    return { error: `1回あたり1〜${MAX_PHOTOS_PER_BATCH}枚までです。` };
  }

  const supabase = await createServerSupabaseClient();
  const project = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("organization_id", workspace.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project.data) {
    return { error: "この現場を開けません。" };
  }

  const ai = getAiService();
  const ids: string[] = [];
  let proposedAny = false;

  for (const item of input.items) {
    if (!isAllowedImageType(item.mimeType)) {
      return { error: "JPEG / PNG / WebP のみ登録できます。" };
    }
    if (!item.storagePath.startsWith(`${workspace.organizationId}/projects/${input.projectId}/`)) {
      return { error: "保存先が不正です。" };
    }
    let imageBase64: string | undefined;
    const downloaded = await supabase.storage.from("org-files").download(item.storagePath);
    if (downloaded.data) {
      const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      if (bytes.byteLength > 0 && bytes.byteLength <= 2_500_000) {
        imageBase64 = Buffer.from(bytes).toString("base64");
      }
    }
    const classified = await ai
      .classifyPhoto({
        storagePath: item.storagePath,
        fileName: item.originalFilename,
        mimeType: item.mimeType,
        imageBase64,
        context: {
          organizationId: workspace.organizationId,
          projectId: input.projectId,
          workOn: item.takenAt.slice(0, 10),
          knownWorkerNames: [],
          knownMaterialCodes: [],
          knownLocationHints: [],
          currentProcessNames: [],
        },
      })
      .catch(
        (): PhotoClassification => ({
          categoryKey: "other",
          tags: [],
          confidence: 0,
        }),
      );
    const proposed = classified.confidence >= 0.5;
    const { error } = await supabase.from("photos").insert({
      id: item.id,
      organization_id: workspace.organizationId,
      project_id: input.projectId,
      captured_by: workspace.userId,
      taken_at: item.takenAt,
      storage_path: item.storagePath,
      original_filename: item.originalFilename,
      work_type_key: classified.workType ?? null,
      location_spot: classified.locationSpot ?? null,
      location_text: [classified.floor, classified.locationSpot, classified.area].filter(Boolean).join(" ") || null,
      floor: classified.floor ?? null,
      area: classified.area ?? null,
      tags: classified.tags,
      proposed_work_type_key: classified.workType ?? null,
      proposed_location_spot: classified.locationSpot ?? null,
      proposed_description: classified.description ?? null,
      proposed_tags: classified.tags,
      classification_status: proposed ? "proposed" : "none",
      classification_confidence: classified.confidence,
      classification_source: imageBase64 ? "vision" : "filename",
      category_key: classified.categoryKey,
      comment: item.comment ?? null,
    });
    if (error) {
      return { error: error.message };
    }
    ids.push(item.id);
    if (proposed) {
      proposedAny = true;
    }
  }

  if (proposedAny) {
    const confirmers = await listMemberProfileIdsWithPermission(
      supabase,
      workspace.organizationId,
      "capture.confirm",
    );
    await notifyWorkspaceMembers(workspace, {
      projectId: input.projectId,
      kind: "confirm_request",
      title: "確認する写真があります",
      href: "/confirm",
      profileIds: confirmers.filter((id) => id !== workspace.userId),
    });
  }

  revalidatePath("/");
  revalidatePath("/photos");
  revalidatePath("/confirm");
  revalidatePath(`/projects/${input.projectId}`);
  return { ids };
}

export async function updatePhotoAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "photo.create")) {
    return { error: "写真を更新する権限がありません。" };
  }
  const photoId = formString(formData, "photoId");
  const workTypeKey = formString(formData, "workTypeKey");
  const locationSpot = formString(formData, "locationSpot");
  const floor = formString(formData, "floor");
  const area = formString(formData, "area");
  const comment = formString(formData, "comment");
  const tags = formString(formData, "tags")
    .split(/[,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("photos")
    .update({
      work_type_key: workTypeKey || null,
      location_spot: locationSpot || null,
      floor: floor || null,
      area: area || null,
      comment: comment || null,
      tags,
      location_text: [floor, locationSpot, area].filter(Boolean).join(" ") || null,
      classification_status: "confirmed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", photoId)
    .eq("organization_id", workspace.organizationId);
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/photos");
  revalidatePath("/confirm");
  return null;
}

export async function acceptPhotoProposalAction(photoId: string): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "photo.create")) {
    return { error: "確認する権限がありません。" };
  }
  const supabase = await createServerSupabaseClient();
  const current = await supabase
    .from("photos")
    .select("proposed_work_type_key, proposed_location_spot, proposed_tags, project_id")
    .eq("id", photoId)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  const row = current.data as {
    proposed_work_type_key: string | null;
    proposed_location_spot: string | null;
    proposed_tags: string[] | null;
    project_id: string | null;
  } | null;
  if (!row) {
    return { error: "写真が見つかりません。" };
  }
  const { error } = await supabase
    .from("photos")
    .update({
      work_type_key: row.proposed_work_type_key,
      location_spot: row.proposed_location_spot,
      tags: row.proposed_tags ?? [],
      classification_status: "confirmed",
    })
    .eq("id", photoId)
    .eq("organization_id", workspace.organizationId);
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/confirm");
  if (row.project_id) {
    revalidatePath(`/projects/${row.project_id}`);
  }
  return null;
}

export async function acceptAllProposedPhotosAction(): Promise<{ error: string } | { count: number }> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "photo.create")) {
    return { error: "確認する権限がありません。" };
  }
  const supabase = await createServerSupabaseClient();
  const pending = await supabase
    .from("photos")
    .select("id, proposed_work_type_key, proposed_location_spot, proposed_tags, floor, area")
    .eq("organization_id", workspace.organizationId)
    .eq("classification_status", "proposed")
    .is("deleted_at", null)
    .limit(50);
  const rows =
    (pending.data as
      | {
          id: string;
          proposed_work_type_key: string | null;
          proposed_location_spot: string | null;
          proposed_tags: string[] | null;
          floor: string | null;
          area: string | null;
        }[]
      | null) ?? [];
  for (const row of rows) {
    const { error } = await supabase
      .from("photos")
      .update({
        work_type_key: row.proposed_work_type_key,
        location_spot: row.proposed_location_spot,
        tags: row.proposed_tags ?? [],
        location_text: [row.floor, row.proposed_location_spot, row.area].filter(Boolean).join(" ") || null,
        classification_status: "confirmed",
      })
      .eq("id", row.id)
      .eq("organization_id", workspace.organizationId);
    if (error) {
      return { error: error.message };
    }
  }
  revalidatePath("/confirm");
  revalidatePath("/photos");
  revalidatePath("/");
  return { count: rows.length };
}

export async function proposePhotoAssistAction(photoId: string): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "photo.create")) {
    return { error: "写真を更新する権限がありません。" };
  }
  const supabase = await createServerSupabaseClient();
  const current = await supabase
    .from("photos")
    .select("id, original_filename, storage_path, comment, proposed_description, project_id")
    .eq("id", photoId)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  const row = current.data as {
    original_filename: string | null;
    storage_path: string;
    comment: string | null;
    proposed_description: string | null;
    project_id: string | null;
  } | null;
  if (!row) {
    return { error: "写真が見つかりません。" };
  }
  const { photoAssistFromFilename, classifyPhotoHeuristic } = await import("@kensapo/ai");
  const classified = classifyPhotoHeuristic(row.original_filename ?? row.storage_path);
  const description = photoAssistFromFilename(row.original_filename ?? undefined, classified.description);
  const { error } = await supabase
    .from("photos")
    .update({
      proposed_description: description,
      proposed_work_type_key: classified.workType ?? null,
      proposed_location_spot: classified.locationSpot ?? null,
      proposed_tags: classified.tags,
      classification_status: "proposed",
    })
    .eq("id", photoId)
    .eq("organization_id", workspace.organizationId);
  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/photos/${photoId}`);
  revalidatePath("/confirm");
  if (row.project_id) {
    revalidatePath(`/projects/${row.project_id}`);
  }
  return null;
}
