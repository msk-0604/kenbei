import "server-only";

import { isProcessDelayed, isTaskOverdue, projectProgressPercent } from "@kensapo/domain";
import { tokyoTodayIso } from "@/lib/dates";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type TaskRecord = {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string | null;
  assigneeName: string | null;
  dueOn: string | null;
  priority: string;
  status: string;
  overdue: boolean;
};

export async function listProjectTasks(projectId: string): Promise<TaskRecord[]> {
  const supabase = await createServerSupabaseClient();
  const today = tokyoTodayIso();
  const { data, error } = await supabase
    .from("project_tasks")
    .select("id, project_id, title, description, due_on, priority, status, memberships:assignee_membership_id(profiles!profile_id(display_name)), projects(name)")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("due_on", { ascending: true, nullsFirst: false });
  if (error) {
    throw new Error(error.message);
  }
  return mapTasks((data as TaskRow[] | null) ?? [], today);
}

export async function listOpenTasks(): Promise<TaskRecord[]> {
  const supabase = await createServerSupabaseClient();
  const today = tokyoTodayIso();
  const { data, error } = await supabase
    .from("project_tasks")
    .select("id, project_id, title, description, due_on, priority, status, memberships:assignee_membership_id(profiles!profile_id(display_name)), projects(name)")
    .neq("status", "done")
    .is("deleted_at", null)
    .order("due_on", { ascending: true, nullsFirst: false })
    .limit(40);
  if (error) {
    throw new Error(error.message);
  }
  return mapTasks((data as TaskRow[] | null) ?? [], today);
}

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_on: string | null;
  priority: string;
  status: string;
  memberships: { profiles: { display_name: string } | { display_name: string }[] | null } | { profiles: { display_name: string } | { display_name: string }[] | null }[] | null;
  projects: { name: string } | { name: string }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapTasks(rows: TaskRow[], today: string): TaskRecord[] {
  return rows.map((row) => {
    const membership = one(row.memberships);
    const profile = one(membership?.profiles ?? null);
    return {
      id: row.id,
      projectId: row.project_id,
      projectName: one(row.projects)?.name ?? "",
      title: row.title,
      description: row.description,
      assigneeName: profile?.display_name ?? null,
      dueOn: row.due_on,
      priority: row.priority,
      status: row.status,
      overdue: isTaskOverdue({ status: row.status, dueOn: row.due_on, todayIso: today }),
    };
  });
}

export type ProcessRecord = {
  id: string;
  name: string;
  plannedStartOn: string | null;
  plannedEndOn: string | null;
  actualStartOn: string | null;
  actualEndOn: string | null;
  percent: number;
  status: string;
  delayed: boolean;
};

export async function listProjectProcesses(projectId: string): Promise<ProcessRecord[]> {
  const supabase = await createServerSupabaseClient();
  const today = tokyoTodayIso();
  const { data, error } = await supabase
    .from("processes")
    .select("id, name, planned_start_on, planned_end_on, actual_start_on, actual_end_on, percent, status, sort_order")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("sort_order");
  if (error) {
    throw new Error(error.message);
  }
  return ((data as ProcessRow[] | null) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    plannedStartOn: row.planned_start_on,
    plannedEndOn: row.planned_end_on,
    actualStartOn: row.actual_start_on,
    actualEndOn: row.actual_end_on,
    percent: row.percent,
    status: row.status,
    delayed: isProcessDelayed({
      status: row.status,
      percent: row.percent,
      plannedEndOn: row.planned_end_on,
      todayIso: today,
    }),
  }));
}

type ProcessRow = {
  id: string;
  name: string;
  planned_start_on: string | null;
  planned_end_on: string | null;
  actual_start_on: string | null;
  actual_end_on: string | null;
  percent: number;
  status: string;
};

export function overallProgress(processes: ProcessRecord[]): number {
  return projectProgressPercent(processes.map((item) => item.percent));
}

export async function listDelayedProcesses(): Promise<(ProcessRecord & { projectId: string; projectName: string })[]> {
  const supabase = await createServerSupabaseClient();
  const today = tokyoTodayIso();
  const { data, error } = await supabase
    .from("processes")
    .select("id, project_id, name, planned_start_on, planned_end_on, actual_start_on, actual_end_on, percent, status, projects(name)")
    .is("deleted_at", null)
    .neq("status", "completed");
  if (error) {
    throw new Error(error.message);
  }
  type Row = ProcessRow & {
    project_id: string;
    projects: { name: string } | { name: string }[] | null;
  };
  return ((data as Row[] | null) ?? [])
    .map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectName: one(row.projects)?.name ?? "",
      name: row.name,
      plannedStartOn: row.planned_start_on,
      plannedEndOn: row.planned_end_on,
      actualStartOn: row.actual_start_on,
      actualEndOn: row.actual_end_on,
      percent: row.percent,
      status: row.status,
      delayed: isProcessDelayed({
        status: row.status,
        percent: row.percent,
        plannedEndOn: row.planned_end_on,
        todayIso: today,
      }),
    }))
    .filter((row) => row.delayed);
}
