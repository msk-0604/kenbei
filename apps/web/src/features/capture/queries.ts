import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { JsonValue } from "@kensapo/domain";

export type CaptureFieldView = {
  id: string;
  fieldKey: string;
  confidence: number;
  proposedValue: JsonValue;
  correctedValue: JsonValue | null;
  confirmedValue: JsonValue | null;
  status: string;
};

export type CaptureView = {
  id: string;
  projectId: string;
  transcript: string | null;
  graphAppliedAt: string | null;
  fields: CaptureFieldView[];
};

export async function getCaptureView(captureId: string): Promise<CaptureView | null> {
  const supabase = await createServerSupabaseClient();
  const capture = await supabase
    .from("captures")
    .select("id, project_id, transcript, graph_applied_at")
    .eq("id", captureId)
    .is("deleted_at", null)
    .maybeSingle();
  const row = capture.data as {
    id: string;
    project_id: string | null;
    transcript: string | null;
    graph_applied_at: string | null;
  } | null;
  if (!row?.project_id) {
    return null;
  }
  const fields = await supabase
    .from("capture_fields")
    .select(
      "id, field_key, confidence, proposed_value_json, corrected_value_json, confirmed_value_json, status",
    )
    .eq("capture_id", captureId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  type FieldRow = {
    id: string;
    field_key: string;
    confidence: number;
    proposed_value_json: JsonValue;
    corrected_value_json: JsonValue | null;
    confirmed_value_json: JsonValue | null;
    status: string;
  };
  return {
    id: row.id,
    projectId: row.project_id,
    transcript: row.transcript,
    graphAppliedAt: row.graph_applied_at,
    fields: ((fields.data as FieldRow[] | null) ?? []).map((field) => ({
      id: field.id,
      fieldKey: field.field_key,
      confidence: field.confidence,
      proposedValue: field.proposed_value_json,
      correctedValue: field.corrected_value_json,
      confirmedValue: field.confirmed_value_json,
      status: field.status,
    })),
  };
}
