"use server";

import { revalidatePath } from "next/cache";
import { SYSTEM_ROLE_CODES, type SystemRoleCode } from "@kensapo/domain";
import { assertOrganizationWritable, can, requireWorkspace } from "@/lib/authz-guard";
import { formString } from "@/lib/form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { toUserActionError } from "@/lib/user-error";

function isRole(value: string): value is SystemRoleCode {
  return (SYSTEM_ROLE_CODES as readonly string[]).includes(value);
}

export async function assignMemberAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  const locked = await assertOrganizationWritable(workspace.organizationId);
  if (locked) {
    return locked;
  }
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
      return { error: toUserActionError(error.message, "保存") };
    }
  } else {
    const { error } = await supabase.from("project_members").insert({
      ...payload,
      created_by: workspace.userId,
    });
    if (error) {
      return { error: toUserActionError(error.message, "保存") };
    }
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  return null;
}
