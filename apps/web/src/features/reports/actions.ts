"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { draftDailyReportTemplate } from "@kensapo/ai";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { tokyoTodayIso } from "@/lib/dates";
import { formNumber, formString } from "@/lib/form";
import { getAiService } from "@/lib/engines";
import { similarProjectsFor } from "@/features/similar/queries";
import { notifyWorkspaceMembers, listMemberProfileIdsWithPermission } from "@/lib/notifications";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createTodayReportDraftAction(projectId: string): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "capture.confirm") && !can(workspace, "project.update")) {
    return { error: "日報を作る権限がありません。" };
  }
  const supabase = await createServerSupabaseClient();
  const today = tokyoTodayIso();
  const project = await supabase
    .from("projects")
    .select("id, name, work_summary")
    .eq("id", projectId)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  const projectRow = project.data as { id: string; name: string; work_summary: string | null } | null;
  if (!projectRow) {
    return { error: "現場が見つかりません。" };
  }

  const photos = await supabase
    .from("photos")
    .select("work_type_key, location_spot, floor, comment, proposed_description")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .gte("taken_at", `${today}T00:00:00+09:00`)
    .lte("taken_at", `${today}T23:59:59+09:00`);
  const photoRows =
    (photos.data as
      | {
          work_type_key: string | null;
          location_spot: string | null;
          floor: string | null;
          comment: string | null;
          proposed_description: string | null;
        }[]
      | null) ?? [];
  const photoIds = await supabase
    .from("photos")
    .select("id")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .gte("taken_at", `${today}T00:00:00+09:00`)
    .lte("taken_at", `${today}T23:59:59+09:00`);

  const tasks = await supabase
    .from("project_tasks")
    .select("title, status")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .neq("status", "done");
  const processes = await supabase
    .from("processes")
    .select("name, percent, status")
    .eq("project_id", projectId)
    .is("deleted_at", null);

  const photoNotes = photoRows.map((row) =>
    [row.floor, row.location_spot, row.work_type_key, row.comment ?? row.proposed_description]
      .filter(Boolean)
      .join(" "),
  );
  const taskNotes = ((tasks.data as { title: string; status: string }[] | null) ?? []).map(
    (row) => `${row.title}（${row.status}）`,
  );
  const processRows = (processes.data as { name: string; percent: number; status: string }[] | null) ?? [];
  const progressNote =
    processRows.length > 0
      ? processRows.map((row) => `${row.name} ${row.percent}%`).join(" / ")
      : undefined;

  const similar = await similarProjectsFor(workspace.organizationId, projectId);
  const similarHints = similar?.matches.slice(0, 3).map((item) => {
    const reason = item.reasons[0]?.label ?? "類似";
    return `${item.name}: ${reason}${item.durationDays ? ` / 工期${item.durationDays}日` : ""}`;
  });
  const draftInput = {
    projectName: projectRow.name,
    workOn: today,
    authorName: workspace.displayName,
    photoNotes,
    taskNotes,
    progressNote,
    workSummary: projectRow.work_summary ?? undefined,
    similarHints,
  };
  const draft = await getAiService()
    .draftDailyReport(draftInput)
    .catch(() => draftDailyReportTemplate(draftInput));

  const existing = await supabase
    .from("daily_reports")
    .select("id, status")
    .eq("project_id", projectId)
    .eq("work_on", today)
    .is("deleted_at", null)
    .maybeSingle();
  const existingRow = existing.data as { id: string; status: string } | null;
  if (existingRow?.status === "confirmed") {
    return { error: "今日の日報はすでに確定しています。" };
  }

  let reportId = existingRow?.id;
  if (reportId) {
    const { error } = await supabase
      .from("daily_reports")
      .update({
        body: draft.body,
        work_location: draft.workLocation ?? null,
        progress_note: draft.progressNote ?? progressNote ?? null,
        issues: draft.issues ?? null,
        safety_notes: draft.safetyNotes ?? null,
        tomorrow_plan: draft.tomorrowPlan ?? null,
        draft_source: "auto",
        status: "draft",
        updated_by: workspace.userId,
      })
      .eq("id", reportId);
    if (error) {
      return { error: error.message };
    }
  } else {
    const inserted = await supabase
      .from("daily_reports")
      .insert({
        organization_id: workspace.organizationId,
        project_id: projectId,
        work_on: today,
        body: draft.body,
        work_location: draft.workLocation ?? null,
        progress_note: draft.progressNote ?? progressNote ?? null,
        issues: draft.issues ?? null,
        safety_notes: draft.safetyNotes ?? null,
        tomorrow_plan: draft.tomorrowPlan ?? null,
        draft_source: "auto",
        status: "draft",
        created_by: workspace.userId,
        updated_by: workspace.userId,
      })
      .select("id")
      .maybeSingle();
    if (inserted.error || !inserted.data) {
      return { error: inserted.error?.message ?? "日報を作成できませんでした。" };
    }
    reportId = (inserted.data as { id: string }).id;
  }

  const ids = ((photoIds.data as { id: string }[] | null) ?? []).map((row) => row.id);
  await supabase.from("daily_report_photos").delete().eq("report_id", reportId);
  if (ids.length > 0) {
    await supabase.from("daily_report_photos").insert(
      ids.slice(0, 12).map((photoId, index) => ({
        organization_id: workspace.organizationId,
        report_id: reportId,
        photo_id: photoId,
        sort_order: index,
        created_by: workspace.userId,
      })),
    );
  }

  const confirmers = await listMemberProfileIdsWithPermission(
    supabase,
    workspace.organizationId,
    "capture.confirm",
  );
  await notifyWorkspaceMembers(workspace, {
    projectId,
    kind: "confirm_request",
    title: "日報の確認依頼があります",
    href: `/reports/${reportId}`,
    profileIds: confirmers.filter((id) => id !== workspace.userId),
    extra: { reportId },
  });

  revalidatePath("/");
  revalidatePath("/confirm");
  redirect(`/reports/${reportId}`);
}

export async function saveReportAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "capture.confirm") && !can(workspace, "project.update")) {
    return { error: "日報を保存する権限がありません。" };
  }
  const reportId = formString(formData, "reportId");
  const workerCount = formNumber(formData, "workerCount");
  const photoIds = formData
    .getAll("photoId")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("daily_reports")
    .update({
      body: formString(formData, "body"),
      weather: formString(formData, "weather") || null,
      work_location: formString(formData, "workLocation") || null,
      worker_count: workerCount,
      partner_companies_text: formString(formData, "partnerCompaniesText") || null,
      equipment_text: formString(formData, "equipmentText") || null,
      progress_note: formString(formData, "progressNote") || null,
      issues: formString(formData, "issues") || null,
      safety_notes: formString(formData, "safetyNotes") || null,
      tomorrow_plan: formString(formData, "tomorrowPlan") || null,
      remarks: formString(formData, "remarks") || null,
      updated_by: workspace.userId,
    })
    .eq("id", reportId)
    .eq("organization_id", workspace.organizationId)
    .eq("status", "draft");
  if (error) {
    return { error: error.message };
  }
  const current = await supabase
    .from("daily_reports")
    .select("project_id")
    .eq("id", reportId)
    .maybeSingle();
  const projectId = (current.data as { project_id: string } | null)?.project_id;
  await supabase.from("daily_report_photos").delete().eq("report_id", reportId);
  if (photoIds.length > 0) {
    await supabase.from("daily_report_photos").insert(
      photoIds.slice(0, 12).map((photoId, index) => ({
        organization_id: workspace.organizationId,
        report_id: reportId,
        photo_id: photoId,
        sort_order: index,
        created_by: workspace.userId,
      })),
    );
  }
  revalidatePath(`/reports/${reportId}`);
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
  return null;
}

export async function confirmReportAction(reportId: string): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "capture.confirm") && !can(workspace, "project.update")) {
    return { error: "日報を確定する権限がありません。" };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("daily_reports")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirmed_by: workspace.userId,
      updated_by: workspace.userId,
    })
    .eq("id", reportId)
    .eq("organization_id", workspace.organizationId)
    .eq("status", "draft");
  if (error) {
    return { error: error.message };
  }
  const current = await supabase
    .from("daily_reports")
    .select("project_id, created_by")
    .eq("id", reportId)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  const report = current.data as { project_id: string; created_by: string | null } | null;
  if (report?.created_by && report.created_by !== workspace.userId) {
    await notifyWorkspaceMembers(workspace, {
      projectId: report.project_id,
      kind: "report_confirm",
      title: "日報が確定されました",
      href: `/reports/${reportId}`,
      profileIds: [report.created_by],
      extra: { reportId },
    });
  }
  revalidatePath("/");
  revalidatePath("/confirm");
  revalidatePath(`/reports/${reportId}`);
  return null;
}
