import "server-only";

import { isProcessDelayed, isTaskOverdue } from "@kensapo/domain";
import type { OpsFacts } from "@kensapo/decision-engine";
import { tokyoTodayIso } from "@/lib/dates";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function loadOpsFacts(organizationId: string): Promise<OpsFacts> {
  const supabase = await createServerSupabaseClient();
  const today = tokyoTodayIso();
  const [tasks, processes, reports, pendingFields, proposedPhotos, reviewTasks, failedPhotos] = await Promise.all([
    supabase
      .from("project_tasks")
      .select("id, project_id, title, status, due_on")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .neq("status", "done"),
    supabase
      .from("processes")
      .select("id, project_id, name, percent, status, planned_end_on")
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    supabase
      .from("daily_reports")
      .select("id, project_id")
      .eq("organization_id", organizationId)
      .eq("status", "draft")
      .is("deleted_at", null),
    supabase
      .from("capture_fields")
      .select("id, project_id")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .is("deleted_at", null),
    supabase
      .from("photos")
      .select("id, project_id")
      .eq("organization_id", organizationId)
      .eq("classification_status", "proposed")
      .is("deleted_at", null),
    supabase
      .from("project_tasks")
      .select("id, project_id, title")
      .eq("organization_id", organizationId)
      .eq("status", "review")
      .is("deleted_at", null),
    supabase
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("classification_status", "failed")
      .is("deleted_at", null),
  ]);

  type Task = { id: string; project_id: string; title: string; status: string; due_on: string | null };
  const overdueTasks = ((tasks.data as Task[] | null) ?? []).filter((row) =>
    isTaskOverdue({ status: row.status, dueOn: row.due_on, todayIso: today }),
  );
  type Proc = { id: string; project_id: string; name: string; percent: number; status: string; planned_end_on: string | null };
  const delayedProcesses = ((processes.data as Proc[] | null) ?? []).filter((row) =>
    isProcessDelayed({
      status: row.status,
      percent: row.percent,
      plannedEndOn: row.planned_end_on,
      todayIso: today,
    }),
  );
  const pendingRows = (pendingFields.data as { id: string; project_id: string }[] | null) ?? [];
  const photoRows = (proposedPhotos.data as { id: string; project_id: string }[] | null) ?? [];
  const pendingConfirmCount = pendingRows.length + photoRows.length;
  return {
    organizationId,
    overdueTasks: overdueTasks.map((row) => ({ id: row.id, projectId: row.project_id, title: row.title })),
    delayedProcesses: delayedProcesses.map((row) => ({ id: row.id, projectId: row.project_id, name: row.name })),
    pendingConfirmCount,
    pendingConfirmProjectId: pendingRows[0]?.project_id ?? photoRows[0]?.project_id ?? null,
    draftReports: ((reports.data as { id: string; project_id: string }[] | null) ?? []).map((row) => ({
      id: row.id,
      projectId: row.project_id,
    })),
    failedUploadCount: failedPhotos.count ?? 0,
    reviewTasks: ((reviewTasks.data as { id: string; project_id: string; title: string }[] | null) ?? []).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
    })),
  };
}
