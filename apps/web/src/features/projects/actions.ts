"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PROJECT_STATUSES, SYSTEM_ROLE_CODES, type SystemRoleCode } from "@kensapo/domain";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { formOptionalDate, formString } from "@/lib/form";
import { notifyWorkspaceMembers } from "@/lib/notifications";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

function isProjectStatus(value: string): value is (typeof PROJECT_STATUSES)[number] {
  return (PROJECT_STATUSES as readonly string[]).includes(value);
}

async function upsertCustomer(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  name: string,
): Promise<string | null> {
  if (!name) {
    return null;
  }
  const existing = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", name)
    .is("deleted_at", null)
    .maybeSingle();
  const found = existing.data as { id: string } | null;
  if (found) {
    return found.id;
  }
  const inserted = await supabase
    .from("customers")
    .insert({
      organization_id: organizationId,
      name,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .maybeSingle();
  return (inserted.data as { id: string } | null)?.id ?? null;
}

function isRole(value: string): value is SystemRoleCode {
  return (SYSTEM_ROLE_CODES as readonly string[]).includes(value);
}

function defaultProjectRole(orgRole: string): SystemRoleCode {
  if (orgRole === "partner" || orgRole === "guest" || orgRole === "office" || orgRole === "worker") {
    return orgRole;
  }
  if (orgRole === "owner" || orgRole === "executive" || orgRole === "manager" || orgRole === "supervisor") {
    return "supervisor";
  }
  return "worker";
}

export async function createProjectAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "project.create")) {
    return { error: "案件を作成する権限がありません。" };
  }
  const name = formString(formData, "name");
  const address = formString(formData, "address");
  const customerName = formString(formData, "customerName");
  const workSummary = formString(formData, "workSummary");
  const cautionNote = formString(formData, "cautionNote");
  const statusRaw = formString(formData, "status") || "active";
  const status = isProjectStatus(statusRaw) ? statusRaw : "active";
  if (!name) {
    return { error: "現場名を入力してください。" };
  }
  const supabase = await createServerSupabaseClient();
  const customerId = await upsertCustomer(supabase, workspace.organizationId, workspace.userId, customerName);
  const inserted = await supabase
    .from("projects")
    .insert({
      organization_id: workspace.organizationId,
      name,
      status,
      customer_id: customerId,
      work_summary: workSummary || null,
      caution_note: cautionNote || null,
      planned_start_on: formOptionalDate(formData, "plannedStartOn"),
      planned_end_on: formOptionalDate(formData, "plannedEndOn"),
      created_by: workspace.userId,
      updated_by: workspace.userId,
    })
    .select("id")
    .maybeSingle();
  if (inserted.error || !inserted.data) {
    return { error: inserted.error?.message ?? "案件を作成できませんでした。" };
  }
  const project = inserted.data as { id: string };
  if (address) {
    const siteError = (
      await supabase.from("project_sites").insert({
        organization_id: workspace.organizationId,
        project_id: project.id,
        address,
        is_primary: true,
        created_by: workspace.userId,
        updated_by: workspace.userId,
      })
    ).error;
    if (siteError) {
      return { error: siteError.message };
    }
  }
  const assignError = (
    await supabase.from("project_members").insert({
      organization_id: workspace.organizationId,
      project_id: project.id,
      membership_id: workspace.membershipId,
      role_in_project: defaultProjectRole(workspace.roleCode),
      status: "active",
      created_by: workspace.userId,
      updated_by: workspace.userId,
    })
  ).error;
  if (assignError) {
    return { error: assignError.message };
  }
  revalidatePath("/");
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "project.update")) {
    return { error: "案件を更新する権限がありません。" };
  }
  const projectId = formString(formData, "projectId");
  const name = formString(formData, "name");
  const address = formString(formData, "address");
  const workSummary = formString(formData, "workSummary");
  const cautionNote = formString(formData, "cautionNote");
  const customerName = formString(formData, "customerName");
  const statusRaw = formString(formData, "status") || "active";
  const status = isProjectStatus(statusRaw) ? statusRaw : "active";
  if (!projectId || !name) {
    return { error: "現場名を入力してください。" };
  }
  const supabase = await createServerSupabaseClient();
  const customerId = await upsertCustomer(supabase, workspace.organizationId, workspace.userId, customerName);
  const { error } = await supabase
    .from("projects")
    .update({
      name,
      status,
      customer_id: customerId,
      work_summary: workSummary || null,
      caution_note: cautionNote || null,
      planned_start_on: formOptionalDate(formData, "plannedStartOn"),
      planned_end_on: formOptionalDate(formData, "plannedEndOn"),
      updated_by: workspace.userId,
    })
    .eq("id", projectId)
    .eq("organization_id", workspace.organizationId);
  if (error) {
    return { error: error.message };
  }
  if (address) {
    const existing = await supabase
      .from("project_sites")
      .select("id")
      .eq("project_id", projectId)
      .eq("is_primary", true)
      .is("deleted_at", null)
      .maybeSingle();
    const site = existing.data as { id: string } | null;
    if (site) {
      await supabase
        .from("project_sites")
        .update({ address, updated_by: workspace.userId })
        .eq("id", site.id);
    } else {
      await supabase.from("project_sites").insert({
        organization_id: workspace.organizationId,
        project_id: projectId,
        address,
        is_primary: true,
        created_by: workspace.userId,
        updated_by: workspace.userId,
      });
    }
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  const members = await supabase
    .from("project_members")
    .select("memberships(profile_id)")
    .eq("project_id", projectId)
    .eq("organization_id", workspace.organizationId)
    .eq("status", "active")
    .is("deleted_at", null);
  const profileIds = [
    ...new Set(
      ((members.data as { memberships: { profile_id: string } | { profile_id: string }[] | null }[] | null) ?? [])
        .map((row) => {
          const membership = row.memberships;
          const one = Array.isArray(membership) ? membership[0] : membership;
          return one?.profile_id;
        })
        .filter((id): id is string => Boolean(id) && id !== workspace.userId),
    ),
  ];
  if (profileIds.length > 0) {
    await notifyWorkspaceMembers(workspace, {
      projectId,
      kind: "project_update",
      title: "現場情報が更新されました",
      body: name,
      href: `/projects/${projectId}`,
      profileIds,
    });
  }
  return null;
}

export async function assignMemberAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "project.update") && !can(workspace, "member.manage")) {
    return { error: "割り当てる権限がありません。" };
  }
  const projectId = formString(formData, "projectId");
  const membershipId = formString(formData, "membershipId");
  const role = formString(formData, "roleInProject");
  const startsOn = formString(formData, "startsOn");
  const endsOn = formString(formData, "endsOn");
  const status = formString(formData, "status") === "inactive" ? "inactive" : "active";
  if (!projectId || !membershipId || !isRole(role)) {
    return { error: "メンバーと役割を選んでください。" };
  }
  const supabase = await createServerSupabaseClient();
  const existing = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("membership_id", membershipId)
    .is("deleted_at", null)
    .maybeSingle();
  const row = existing.data as { id: string } | null;
  const payload = {
    organization_id: workspace.organizationId,
    project_id: projectId,
    membership_id: membershipId,
    role_in_project: role,
    starts_on: startsOn || null,
    ends_on: endsOn || null,
    status,
    updated_by: workspace.userId,
  };
  if (row) {
    const { error } = await supabase.from("project_members").update(payload).eq("id", row.id);
    if (error) {
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("project_members").insert({
      ...payload,
      created_by: workspace.userId,
    });
    if (error) {
      return { error: error.message };
    }
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  return null;
}
