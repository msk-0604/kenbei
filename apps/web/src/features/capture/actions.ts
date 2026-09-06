"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  needsHumanConfirm,
  type CaptureFieldRecord,
  type JsonValue,
} from "@kensapo/domain";
import { getAiService, getConstructionGraph } from "@/lib/engines";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { tokyoTodayIso } from "@/lib/dates";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function asJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => asJsonValue(item));
  }
  if (typeof value === "object") {
    const record: { [key: string]: JsonValue } = {};
    for (const [key, item] of Object.entries(value)) {
      record[key] = asJsonValue(item);
    }
    return record;
  }
  return String(value);
}

export async function submitVoiceCaptureAction(formData: FormData): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "capture.create")) {
    return { error: "報告する権限がありません。" };
  }
  const projectId = String(formData.get("projectId") ?? "");
  const audio = formData.get("audio");
  if (!projectId) {
    return { error: "現場がありません。" };
  }
  if (!(audio instanceof File) || audio.size === 0) {
    return { error: "音声を録音してください。" };
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

  const captureId = crypto.randomUUID();
  const fileName = `${captureId}.webm`;
  const storagePath = `${workspace.organizationId}/projects/${projectId}/captures/${fileName}`;
  const bytes = new Uint8Array(await audio.arrayBuffer());

  const upload = await supabase.storage.from("org-files").upload(storagePath, audio, {
    contentType: audio.type || "audio/webm",
    upsert: false,
  });
  if (upload.error) {
    return { error: `音声を保存できませんでした: ${upload.error.message}` };
  }

  const insertCapture = await supabase.from("captures").insert({
    id: captureId,
    organization_id: workspace.organizationId,
    project_id: projectId,
    kind: "voice",
    raw_input: null,
    audio_storage_path: storagePath,
    created_by: workspace.userId,
    updated_by: workspace.userId,
  });
  if (insertCapture.error) {
    return { error: insertCapture.error.message };
  }

  const ai = getAiService();
  const transcription = await ai.transcribe({
    organizationId: workspace.organizationId,
    mimeType: audio.type || "audio/webm",
    storagePath,
    fileName,
    audioBytes: bytes,
  });
  const structured = await ai.structureCapture(transcription.text, {
    organizationId: workspace.organizationId,
    projectId,
    workOn: tokyoTodayIso(),
    knownWorkerNames: [],
    knownMaterialCodes: [],
    knownLocationHints: [],
    currentProcessNames: [],
  });

  const captureUpdate = await supabase
    .from("captures")
    .update({
      transcript: transcription.text,
      extraction_json: structured.rawExtraction,
      ai_provider: structured.provider,
      ai_model: structured.model,
      processing_version: structured.processingVersion,
      updated_by: workspace.userId,
    })
    .eq("id", captureId);
  if (captureUpdate.error) {
    return { error: captureUpdate.error.message };
  }

  const fieldRows = structured.fields.map((item) => {
    const auto = !item.needsConfirmation && !needsHumanConfirm(item.confidence);
    return {
      organization_id: workspace.organizationId,
      capture_id: captureId,
      project_id: projectId,
      field_key: item.key,
      confidence: item.confidence,
      proposed_value_json: asJsonValue(item.value),
      status: auto ? "auto_accepted" : "pending",
      source: "speech",
    };
  });
  if (fieldRows.length > 0) {
    const fieldsInsert = await supabase.from("capture_fields").insert(fieldRows);
    if (fieldsInsert.error) {
      return { error: fieldsInsert.error.message };
    }
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/captures/${captureId}/confirm`);
}

async function loadField(fieldId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("capture_fields")
    .select(
      "id, capture_id, project_id, organization_id, field_key, confidence, proposed_value_json, corrected_value_json, confirmed_value_json, status",
    )
    .eq("id", fieldId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as {
    id: string;
    capture_id: string;
    project_id: string | null;
    organization_id: string;
    field_key: string;
    confidence: number;
    proposed_value_json: JsonValue;
    corrected_value_json: JsonValue | null;
    confirmed_value_json: JsonValue | null;
    status: string;
  };
}

export async function confirmFieldAction(formData: FormData): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "capture.confirm")) {
    return { error: "確定する権限がありません。" };
  }
  const fieldId = String(formData.get("fieldId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const correction = String(formData.get("correction") ?? "").trim();
  const field = await loadField(fieldId);
  if (!field || field.organization_id !== workspace.organizationId) {
    return { error: "項目が見つかりません。" };
  }
  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();
  if (decision === "ok") {
    const { error } = await supabase
      .from("capture_fields")
      .update({
        status: "confirmed",
        confirmed_value_json: field.proposed_value_json,
        confirmed_by: workspace.userId,
        confirmed_at: now,
        updated_by: workspace.userId,
      })
      .eq("id", fieldId);
    if (error) {
      return { error: error.message };
    }
  } else if (decision === "correct") {
    if (!correction) {
      return { error: "修正内容を入力してください。" };
    }
    const { error } = await supabase
      .from("capture_fields")
      .update({
        status: "corrected",
        corrected_value_json: correction,
        confirmed_value_json: correction,
        confirmed_by: workspace.userId,
        confirmed_at: now,
        updated_by: workspace.userId,
      })
      .eq("id", fieldId);
    if (error) {
      return { error: error.message };
    }
  } else if (decision === "skip") {
    revalidatePath(`/captures/${field.capture_id}/confirm`);
    return null;
  } else {
    return { error: "操作を選んでください。" };
  }
  revalidatePath(`/captures/${field.capture_id}/confirm`);
  return null;
}

function toRecord(row: {
  field_key: string;
  confidence: number;
  proposed_value_json: JsonValue;
  corrected_value_json: JsonValue | null;
  confirmed_value_json: JsonValue | null;
  status: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
}): CaptureFieldRecord {
  return {
    fieldKey: row.field_key,
    confidence: row.confidence,
    proposedValue: row.proposed_value_json,
    correctedValue: row.corrected_value_json,
    confirmedValue: row.confirmed_value_json,
    status: row.status as CaptureFieldRecord["status"],
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
  };
}

export async function finishCaptureAction(captureId: string): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "capture.confirm")) {
    return { error: "確定する権限がありません。" };
  }
  const supabase = await createServerSupabaseClient();
  const capture = await supabase
    .from("captures")
    .select("id, project_id, organization_id, graph_applied_at")
    .eq("id", captureId)
    .maybeSingle();
  const captureRow = capture.data as {
    id: string;
    project_id: string | null;
    organization_id: string;
    graph_applied_at: string | null;
  } | null;
  if (!captureRow?.project_id || captureRow.organization_id !== workspace.organizationId) {
    return { error: "報告が見つかりません。" };
  }
  if (captureRow.graph_applied_at) {
    redirect(`/projects/${captureRow.project_id}`);
  }

  const now = new Date().toISOString();
  const autoRows = await supabase
    .from("capture_fields")
    .select("id, proposed_value_json")
    .eq("capture_id", captureId)
    .eq("status", "auto_accepted")
    .is("confirmed_value_json", null);
  for (const row of (autoRows.data as { id: string; proposed_value_json: JsonValue }[] | null) ?? []) {
    await supabase
      .from("capture_fields")
      .update({
        status: "confirmed",
        confirmed_value_json: row.proposed_value_json,
        confirmed_by: workspace.userId,
        confirmed_at: now,
        updated_by: workspace.userId,
      })
      .eq("id", row.id);
  }

  const fields = await supabase
    .from("capture_fields")
    .select(
      "field_key, confidence, proposed_value_json, corrected_value_json, confirmed_value_json, status, confirmed_by, confirmed_at",
    )
    .eq("capture_id", captureId)
    .is("deleted_at", null);

  const records = ((fields.data as Parameters<typeof toRecord>[0][] | null) ?? []).map(toRecord);
  const graph = await getConstructionGraph();
  await graph.applyConfirmedCapture({
    organizationId: workspace.organizationId,
    projectId: captureRow.project_id,
    captureId,
    occurredOn: tokyoTodayIso(),
    createdBy: workspace.userId,
    fields: records,
  });

  revalidatePath("/");
  revalidatePath(`/projects/${captureRow.project_id}`);
  revalidatePath(`/captures/${captureId}/confirm`);
  redirect(`/projects/${captureRow.project_id}`);
}
