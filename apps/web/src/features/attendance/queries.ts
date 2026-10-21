import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { currentOrganizationId } from "@/lib/org-scope";
import { monthBounds, summarizeAttendance, type WorkerAttendance } from "@/features/attendance/summary";

type Row = {
  schedule_date: string;
  worker_id: string;
  project_id: string;
  actual_start_time: string | null;
  actual_end_time: string | null;
  workers: { name: string } | { name: string }[] | null;
  projects: { name: string } | { name: string }[] | null;
};

const one = <T,>(value: T | T[] | null): T | null => (!value ? null : Array.isArray(value) ? (value[0] ?? null) : value);

/** その月に「作業開始」が押された予定から、作業員ごとの出面をまとめる */
export async function getMonthAttendance(month: string): Promise<WorkerAttendance[]> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { from, to } = monthBounds(month);
  const { data, error } = await supabase
    .from("schedules")
    .select("schedule_date, worker_id, project_id, actual_start_time, actual_end_time, workers(name), projects!inner(name, deleted_at)")
    .eq("organization_id", organizationId)
    .gte("schedule_date", from)
    .lte("schedule_date", to)
    .neq("status", "cancelled")
    .not("worker_id", "is", null)
    .not("actual_start_time", "is", null)
    .is("projects.deleted_at", null)
    .order("schedule_date", { ascending: true })
    .limit(5000);
  if (error) {
    throw new Error(error.message);
  }
  return summarizeAttendance(
    ((data as Row[] | null) ?? []).map((row) => ({
      date: row.schedule_date,
      workerId: row.worker_id,
      workerName: one(row.workers)?.name ?? "作業員",
      siteId: row.project_id,
      siteName: one(row.projects)?.name ?? "現場",
      startedAt: row.actual_start_time,
      endedAt: row.actual_end_time,
    })),
  );
}
