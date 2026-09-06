import "server-only";

import { isProcessDelayed, isTaskOverdue } from "@kensapo/domain";
import type { OpsBriefFacts } from "@kensapo/ai";
import { tokyoTodayIso } from "@/lib/dates";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function loadOpsBriefFacts(
  organizationId: string,
  projectId: string | null,
): Promise<OpsBriefFacts> {
  const supabase = await createServerSupabaseClient();
  const today = tokyoTodayIso();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const org = await supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle();
  let projectName: string | undefined;
  if (projectId) {
    const project = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    projectName = (project.data as { name: string } | null)?.name;
  }

  let tasksQuery = supabase
    .from("project_tasks")
    .select("title, status, due_on")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .neq("status", "done");
  let procQuery = supabase
    .from("processes")
    .select("name, percent, status, planned_end_on")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  let pendingQuery = supabase
    .from("capture_fields")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .is("deleted_at", null);
  let draftQuery = supabase
    .from("daily_reports")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "draft")
    .is("deleted_at", null);
  let weekQuery = supabase
    .from("daily_reports")
    .select("work_on, body")
    .eq("organization_id", organizationId)
    .gte("work_on", weekAgo)
    .is("deleted_at", null)
    .order("work_on", { ascending: false })
    .limit(12);
  let chatQuery = supabase
    .from("project_messages")
    .select("body")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (projectId) {
    tasksQuery = tasksQuery.eq("project_id", projectId);
    procQuery = procQuery.eq("project_id", projectId);
    pendingQuery = pendingQuery.eq("project_id", projectId);
    draftQuery = draftQuery.eq("project_id", projectId);
    weekQuery = weekQuery.eq("project_id", projectId);
    chatQuery = chatQuery.eq("project_id", projectId);
  }

  const [tasks, processes, pending, drafts, week, chat] = await Promise.all([
    tasksQuery,
    procQuery,
    pendingQuery,
    draftQuery,
    weekQuery,
    chatQuery,
  ]);

  const overdueTaskTitles = ((tasks.data as { title: string; status: string; due_on: string | null }[] | null) ?? [])
    .filter((row) => isTaskOverdue({ status: row.status, dueOn: row.due_on, todayIso: today }))
    .map((row) => row.title);
  const delayedProcessNames = (
    (processes.data as { name: string; percent: number; status: string; planned_end_on: string | null }[] | null) ?? []
  )
    .filter((row) =>
      isProcessDelayed({
        status: row.status,
        percent: row.percent,
        plannedEndOn: row.planned_end_on,
        todayIso: today,
      }),
    )
    .map((row) => row.name);

  return {
    organizationName: (org.data as { name: string } | null)?.name ?? "",
    projectName,
    pendingConfirmCount: pending.count ?? 0,
    overdueTaskTitles,
    delayedProcessNames,
    draftReportCount: drafts.count ?? 0,
    failedUploadCount: 0,
    chatLines: ((chat.data as { body: string }[] | null) ?? []).map((row) => row.body.slice(0, 80)),
    reportLines: ((week.data as { work_on: string; body: string }[] | null) ?? []).map(
      (row) => `${row.work_on}: ${row.body.slice(0, 80)}`,
    ),
  };
}
