"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertOrganizationWritable, can, requireWorkspace } from "@/lib/authz-guard";
import { tokyoTodayIso } from "@/lib/dates";
import { formNumber, formString } from "@/lib/form";
import { toUserActionError } from "@/lib/user-error";
import { notifyWorkspaceMembers, listMemberProfileIdsWithPermission } from "@/lib/notifications";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Opens today's report for this site. Reports are written by hand: a new one
 * starts blank (today's photos pre-attached), and an existing draft is never
 * overwritten.
 */
export async function createTodayReportDraftAction(projectId: string): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  const locked = await assertOrganizationWritable(workspace.organizationId);
  if (locked) {
    return locked;
  }
  if (!can(workspace, "capture.confirm") && !can(workspace, "project.update")) {
    return { error: "日報を作る権限がありません。" };
  }
  const supabase = await createServerSupabaseClient();
  const today = tokyoTodayIso();
  const project = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  if (!project.data) {
    return { error: "現場が見つかりません。" };
  }

  const existing = await supabase
    .from("daily_reports")
    .select("id")
    .eq("project_id", projectId)
    .eq("work_on", today)
    .is("deleted_at", null)
    .maybeSingle();
  const existingId = (existing.data as { id: string } | null)?.id;
  if (existingId) {
    redirect(`/reports/${existingId}`);
  }

  const inserted = await supabase
    .from("daily_reports")
    .insert({
      organization_id: workspace.organizationId,
      project_id: projectId,
      work_on: today,
      body: "",
      draft_source: "manual",
      status: "draft",
      created_by: workspace.userId,
      updated_by: workspace.userId,
    })
    .select("id")
    .maybeSingle();
  if (inserted.error || !inserted.data) {
    return { error: toUserActionError(inserted.error?.message, "日報を作成") };
  }
  const reportId = (inserted.data as { id: string }).id;

  const photoIds = await supabase
    .from("photos")
    .select("id")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .gte("taken_at", `${today}T00:00:00+09:00`)
    .lte("taken_at", `${today}T23:59:59+09:00`);
  const ids = ((photoIds.data as { id: string }[] | null) ?? []).map((row) => row.id);
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

  revalidatePath("/");
  redirect(`/reports/${reportId}`);
}

export async function saveReportAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  const locked = await assertOrganizationWritable(workspace.organizationId);
  if (locked) {
    return locked;
  }
  if (!can(workspace, "capture.confirm") && !can(workspace, "project.update")) {
    return { error: "日報を保存する権限がありません。" };
  }
  const reportId = formString(formData, "reportId");
  const body = formString(formData, "body");
  const workerCount = formNumber(formData, "workerCount");
  const photoIds = formData
    .getAll("photoId")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const supabase = await createServerSupabaseClient();
  const before = await supabase
    .from("daily_reports")
    .select("body")
    .eq("id", reportId)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  const firstWrite = !(before.data as { body: string } | null)?.body?.trim() && Boolean(body.trim());
  const { error } = await supabase
    .from("daily_reports")
    .update({
      body,
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
    return { error: toUserActionError(error.message, "日報を保存") };
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
  if (firstWrite && projectId) {
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
    revalidatePath("/confirm");
  }
  revalidatePath(`/reports/${reportId}`);
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
  return null;
}

export async function confirmReportAction(reportId: string): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  const locked = await assertOrganizationWritable(workspace.organizationId);
  if (locked) {
    return locked;
  }
  if (!can(workspace, "capture.confirm") && !can(workspace, "project.update")) {
    return { error: "日報を確定する権限がありません。" };
  }
  const supabase = await createServerSupabaseClient();
  const draft = await supabase
    .from("daily_reports")
    .select("body")
    .eq("id", reportId)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  if (!(draft.data as { body: string } | null)?.body?.trim()) {
    return { error: "作業内容を書いて「日報を保存」してから確定してください。" };
  }
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
    return { error: toUserActionError(error.message, "日報を確定") };
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
