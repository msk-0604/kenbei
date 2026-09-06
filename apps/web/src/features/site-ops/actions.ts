"use server";

import { revalidatePath } from "next/cache";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { formOptionalDate, formString } from "@/lib/form";
import { notifyWorkspaceMembers, listMemberProfileIdsWithPermission, profileIdForMembership } from "@/lib/notifications";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createTaskAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "project.update") && !can(workspace, "capture.create")) {
    return { error: "タスクを作る権限がありません。" };
  }
  const projectId = formString(formData, "projectId");
  const title = formString(formData, "title");
  if (!projectId || !title) {
    return { error: "タスク名を入力してください。" };
  }
  const supabase = await createServerSupabaseClient();
  const assigneeMembershipId = formString(formData, "assigneeMembershipId") || null;
  const { data, error } = await supabase
    .from("project_tasks")
    .insert({
    organization_id: workspace.organizationId,
    project_id: projectId,
    title,
    description: formString(formData, "description") || null,
    due_on: formOptionalDate(formData, "dueOn"),
    priority: formString(formData, "priority") || "normal",
    status: "todo",
    assignee_membership_id: assigneeMembershipId,
    created_by: workspace.userId,
    updated_by: workspace.userId,
  })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { error: error?.message ?? "タスクを作成できませんでした。" };
  }
  if (assigneeMembershipId) {
    const profileId = await profileIdForMembership(supabase, workspace.organizationId, assigneeMembershipId);
    if (profileId && profileId !== workspace.userId) {
      await notifyWorkspaceMembers(workspace, {
        projectId,
        kind: "task_assignment",
        title: "タスクが割り当てられました",
        body: title,
        href: `/tasks/${(data as { id: string }).id}`,
        profileIds: [profileId],
        extra: { taskId: (data as { id: string }).id },
      });
    }
  }
  revalidatePath("/");
  revalidatePath("/confirm");
  revalidatePath(`/projects/${projectId}`);
  return null;
}

export async function updateTaskStatusAction(taskId: string, status: string, projectId: string): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "project.update") && !can(workspace, "capture.create")) {
    return { error: "更新する権限がありません。" };
  }
  const supabase = await createServerSupabaseClient();
  const current = await supabase
    .from("project_tasks")
    .select("title, status, assignee_membership_id")
    .eq("id", taskId)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  const { error } = await supabase
    .from("project_tasks")
    .update({ status, updated_by: workspace.userId })
    .eq("id", taskId)
    .eq("organization_id", workspace.organizationId);
  if (error) {
    return { error: error.message };
  }
  const row = current.data as
    | { title: string; status: string; assignee_membership_id: string | null }
    | null;
  if (status === "review" && row) {
    const confirmers = await listMemberProfileIdsWithPermission(
      supabase,
      workspace.organizationId,
      "capture.confirm",
    );
    await notifyWorkspaceMembers(workspace, {
      projectId,
      kind: "confirm_request",
      title: "タスクの確認依頼があります",
      body: row.title,
      href: "/confirm",
      profileIds: confirmers.filter((id) => id !== workspace.userId),
      extra: { taskId },
    });
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/confirm");
  return null;
}

export async function createProcessAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "project.update")) {
    return { error: "工程を登録する権限がありません。" };
  }
  const projectId = formString(formData, "projectId");
  const name = formString(formData, "name");
  if (!projectId || !name) {
    return { error: "工程名を入力してください。" };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("processes").insert({
    organization_id: workspace.organizationId,
    project_id: projectId,
    name,
    planned_start_on: formOptionalDate(formData, "plannedStartOn"),
    planned_end_on: formOptionalDate(formData, "plannedEndOn"),
    percent: 0,
    status: "not_started",
    created_by: workspace.userId,
    updated_by: workspace.userId,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/projects/${projectId}`);
  return null;
}

export async function updateProcessAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "project.update")) {
    return { error: "工程を更新する権限がありません。" };
  }
  const processId = formString(formData, "processId");
  const projectId = formString(formData, "projectId");
  const percent = Number(formString(formData, "percent") || "0");
  const status = formString(formData, "status") || "not_started";
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("processes")
    .update({
      percent: Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0,
      status,
      actual_start_on: formOptionalDate(formData, "actualStartOn"),
      actual_end_on: formOptionalDate(formData, "actualEndOn"),
      updated_by: workspace.userId,
    })
    .eq("id", processId)
    .eq("organization_id", workspace.organizationId);
  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  revalidatePath("/confirm");
  return null;
}

export async function createProposedTasksAction(
  _prev: { error: string } | { created: number } | null,
  formData: FormData,
): Promise<{ error: string } | { created: number } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "project.update") && !can(workspace, "capture.create")) {
    return { error: "タスクを作る権限がありません。" };
  }
  const projectId = formString(formData, "projectId");
  const titles = formData
    .getAll("titles")
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!projectId || titles.length === 0) {
    return { error: "追加する提案を選んでください。" };
  }
  const supabase = await createServerSupabaseClient();
  const project = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  if (!project.data) {
    return { error: "この現場を開けません。" };
  }
  const { error } = await supabase.from("project_tasks").insert(
    titles.map((title) => ({
      organization_id: workspace.organizationId,
      project_id: projectId,
      title,
      status: "todo",
      priority: "normal",
      created_by: workspace.userId,
      updated_by: workspace.userId,
    })),
  );
  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  return { created: titles.length };
}
