import "server-only";

import type { GraphStore } from "@kensapo/graph";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export function createSupabaseGraphStore(supabase: Db): GraphStore {
  return {
    async insertWorkEvent(input) {
      const { error } = await supabase.from("work_events").insert({
        organization_id: input.organizationId,
        project_id: input.projectId,
        capture_id: input.captureId,
        work_type_key: input.workTypeKey,
        work_description: input.workDescription,
        location: input.location,
        issue: input.issue,
        next_action: input.nextAction,
        note: input.note,
        created_by: input.createdBy,
        updated_by: input.createdBy,
      });
      if (error && !error.message.includes("duplicate") && error.code !== "23505") {
        throw new Error(error.message);
      }
    },
    async insertMaterialUsage(input) {
      const { error } = await supabase.from("material_usages").insert({
        organization_id: input.organizationId,
        project_id: input.projectId,
        material_code_text: input.materialCode,
        quantity: input.quantity,
        unit: input.unit,
        used_on: input.occurredOn,
        source_capture_id: input.captureId,
        created_by: input.createdBy,
        updated_by: input.createdBy,
      });
      if (error) {
        throw new Error(error.message);
      }
    },
    async insertIncident(input) {
      const { data, error } = await supabase
        .from("incidents")
        .insert({
          organization_id: input.organizationId,
          project_id: input.projectId,
          kind: "trouble",
          title: input.title,
          occurred_on: input.occurredOn,
          created_by: input.createdBy,
          updated_by: input.createdBy,
        })
        .select("id")
        .maybeSingle();
      if (error) {
        throw new Error(error.message);
      }
      const incident = data as { id: string } | null;
      if (incident && input.action) {
        const actionError = (
          await supabase.from("incident_actions").insert({
            organization_id: input.organizationId,
            incident_id: incident.id,
            body: input.action,
            created_by: input.createdBy,
          })
        ).error;
        if (actionError) {
          throw new Error(actionError.message);
        }
      }
    },
    async ensureWorkType(input) {
      const existing = await supabase
        .from("project_work_types")
        .select("id")
        .eq("project_id", input.projectId)
        .eq("work_type_key", input.workTypeKey)
        .is("deleted_at", null)
        .maybeSingle();
      if (existing.data) {
        return;
      }
      const { error } = await supabase.from("project_work_types").insert({
        organization_id: input.organizationId,
        project_id: input.projectId,
        work_type_key: input.workTypeKey,
        created_by: input.createdBy,
      });
      if (error && error.code !== "23505") {
        throw new Error(error.message);
      }
    },
    async markCaptureApplied(captureId) {
      const { error } = await supabase
        .from("captures")
        .update({ graph_applied_at: new Date().toISOString() })
        .eq("id", captureId);
      if (error) {
        throw new Error(error.message);
      }
    },
  };
}
