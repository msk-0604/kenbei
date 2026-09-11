import "server-only";

import { isProcessDelayed, isTaskOverdue, projectProgressPercent } from "@kensapo/domain";
import { tokyoTodayIso } from "@/lib/dates";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/session";

export type TodayProject = {
  projectId: string;
  projectName: string;
  address: string | null;
  roleInProject: string;
  workSummary: string | null;
  sessionId: string | null;
  startedAt: string | null;
  endedAt: string | null;
};

type SiteRow = { address: string | null; is_primary: boolean };
type ProjectEmbed = {
  id: string;
  name: string;
  work_summary: string | null;
  project_sites: SiteRow[] | SiteRow | null;
};
type MemberRow = {
  role_in_project: string;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
  projects: ProjectEmbed | ProjectEmbed[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function primaryAddress(sites: SiteRow[] | SiteRow | null): string | null {
  if (!sites) {
    return null;
  }
  const list = Array.isArray(sites) ? sites : [sites];
  const primary = list.find((site) => site.is_primary) ?? list[0];
  return primary?.address ?? null;
}

export async function listTodayProjects(workspace: Workspace): Promise<TodayProject[]> {
  const supabase = await createServerSupabaseClient();
  const today = tokyoTodayIso();
  const [members, sessions] = await Promise.all([
    supabase
      .from("project_members")
      .select(
        "role_in_project, starts_on, ends_on, status, projects(id, name, work_summary, project_sites(address, is_primary))",
      )
      .eq("membership_id", workspace.membershipId)
      .eq("status", "active")
      .is("deleted_at", null),
    supabase
      .from("site_sessions")
      .select("id, project_id, started_at, ended_at")
      .eq("membership_id", workspace.membershipId)
      .eq("organization_id", workspace.organizationId)
      .eq("work_on", today)
      .is("deleted_at", null),
  ]);

  if (members.error) {
    throw new Error(members.error.message);
  }

  const rows = (members.data as MemberRow[] | null) ?? [];
  const assigned = rows.filter((row) => {
    if (row.starts_on && row.starts_on > today) {
      return false;
    }
    if (row.ends_on && row.ends_on < today) {
      return false;
    }
    return one(row.projects) !== null;
  });

  const sessionRows = (sessions.data as
    | { id: string; project_id: string; started_at: string | null; ended_at: string | null }[]
    | null) ?? [];
  const sessionByProject = new Map(sessionRows.map((row) => [row.project_id, row]));

  return assigned.map((row) => {
    const project = one(row.projects);
    if (!project) {
      throw new Error("assigned project missing");
    }
    const session = sessionByProject.get(project.id);
    return {
      projectId: project.id,
      projectName: project.name,
      address: primaryAddress(project.project_sites),
      roleInProject: row.role_in_project,
      workSummary: project.work_summary,
      sessionId: session?.id ?? null,
      startedAt: session?.started_at ?? null,
      endedAt: session?.ended_at ?? null,
    };
  });
}

export async function countPendingCaptures(workspace: Workspace): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("capture_fields")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", workspace.organizationId)
    .eq("status", "pending")
    .is("deleted_at", null);
  if (error) {
    return 0;
  }
  return count ?? 0;
}

export async function latestPendingCaptureId(workspace: Workspace): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("capture_fields")
    .select("capture_id")
    .eq("organization_id", workspace.organizationId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as { capture_id: string } | null;
  return row?.capture_id ?? null;
}

export type TodayBoardProject = TodayProject & {
  photoCount: number;
  reportStatus: "none" | "draft" | "confirmed";
  reportId: string | null;
  progressPercent: number;
  overdueTaskCount: number;
  delayed: boolean;
};

export type TodayOps = {
  photoCount: number;
  openTaskCount: number;
  overdueTaskCount: number;
  draftReportCount: number;
  delayedCount: number;
  confirmCount: number;
};

export async function loadTodayBoard(workspace: Workspace): Promise<{
  projects: TodayBoardProject[];
  ops: TodayOps;
  pendingCaptureId: string | null;
}> {
  const today = tokyoTodayIso();
  const supabase = await createServerSupabaseClient();
  const [projects, pendingCapture] = await Promise.all([
    listTodayProjects(workspace),
    supabase
      .from("capture_fields")
      .select("capture_id", { count: "exact" })
      .eq("organization_id", workspace.organizationId)
      .eq("status", "pending")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const pendingCaptures = pendingCapture.count ?? 0;
  const pendingCaptureId =
    ((pendingCapture.data as { capture_id: string }[] | null) ?? [])[0]?.capture_id ?? null;
  const ids = projects.map((item) => item.projectId);
  if (ids.length === 0) {
    return {
      projects: [],
      ops: {
        photoCount: 0,
        openTaskCount: 0,
        overdueTaskCount: 0,
        draftReportCount: 0,
        delayedCount: 0,
        confirmCount: pendingCaptures,
      },
      pendingCaptureId,
    };
  }

  const [photos, reports, tasks, processes, proposedPhotos] = await Promise.all([
    supabase
      .from("photos")
      .select("id, project_id")
      .in("project_id", ids)
      .eq("organization_id", workspace.organizationId)
      .is("deleted_at", null)
      .gte("taken_at", `${today}T00:00:00+09:00`)
      .lte("taken_at", `${today}T23:59:59+09:00`),
    supabase
      .from("daily_reports")
      .select("id, project_id, status")
      .in("project_id", ids)
      .eq("organization_id", workspace.organizationId)
      .eq("work_on", today)
      .is("deleted_at", null),
    supabase
      .from("project_tasks")
      .select("id, project_id, status, due_on")
      .in("project_id", ids)
      .eq("organization_id", workspace.organizationId)
      .neq("status", "done")
      .is("deleted_at", null),
    supabase
      .from("processes")
      .select("project_id, percent, status, planned_end_on")
      .in("project_id", ids)
      .eq("organization_id", workspace.organizationId)
      .is("deleted_at", null),
    supabase
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.organizationId)
      .eq("classification_status", "proposed")
      .is("deleted_at", null),
  ]);

  const photoRows = (photos.data as { id: string; project_id: string }[] | null) ?? [];
  const reportRows = (reports.data as { id: string; project_id: string; status: string }[] | null) ?? [];
  const taskRows =
    (tasks.data as { id: string; project_id: string; status: string; due_on: string | null }[] | null) ?? [];
  const processRows =
    (processes.data as
      | { project_id: string; percent: number; status: string; planned_end_on: string | null }[]
      | null) ?? [];

  const board = projects.map((project) => {
    const projectPhotos = photoRows.filter((row) => row.project_id === project.projectId);
    const report = reportRows.find((row) => row.project_id === project.projectId);
    const projectTasks = taskRows.filter((row) => row.project_id === project.projectId);
    const projectProcesses = processRows.filter((row) => row.project_id === project.projectId);
    const delayed = projectProcesses.some((row) =>
      isProcessDelayed({
        status: row.status,
        percent: row.percent,
        plannedEndOn: row.planned_end_on,
        todayIso: today,
      }),
    );
    return {
      ...project,
      photoCount: projectPhotos.length,
      reportStatus: (report?.status === "confirmed" ? "confirmed" : report ? "draft" : "none") as
        | "none"
        | "draft"
        | "confirmed",
      reportId: report?.id ?? null,
      progressPercent: projectProgressPercent(projectProcesses.map((row) => row.percent)),
      overdueTaskCount: projectTasks.filter((row) =>
        isTaskOverdue({ status: row.status, dueOn: row.due_on, todayIso: today }),
      ).length,
      delayed,
    };
  });

  const draftReports = reportRows.filter((row) => row.status === "draft").length;
  const overdue = board.reduce((sum, item) => sum + item.overdueTaskCount, 0);
  const delayedCount = board.filter((item) => item.delayed).length;
  return {
    projects: board,
    ops: {
      photoCount: photoRows.length,
      openTaskCount: taskRows.length,
      overdueTaskCount: overdue,
      draftReportCount: draftReports,
      delayedCount,
      confirmCount:
        draftReports + overdue + delayedCount + (proposedPhotos.count ?? 0) + pendingCaptures,
    },
    pendingCaptureId,
  };
}
