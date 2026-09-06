"use server";

import { revalidatePath } from "next/cache";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { tokyoTodayIso } from "@/lib/dates";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function startSiteAction(projectId: string): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "capture.create")) {
    return { error: "現場開始の権限がありません。" };
  }
  const supabase = await createServerSupabaseClient();
  const today = tokyoTodayIso();
  const existing = await supabase
    .from("site_sessions")
    .select("id, started_at")
    .eq("project_id", projectId)
    .eq("membership_id", workspace.membershipId)
    .eq("work_on", today)
    .is("deleted_at", null)
    .maybeSingle();
  const row = existing.data as { id: string; started_at: string | null } | null;
  if (row?.id) {
    const { error } = await supabase
      .from("site_sessions")
      .update({
        started_at: row.started_at ?? new Date().toISOString(),
        ended_at: null,
        updated_by: workspace.userId,
      })
      .eq("id", row.id);
    if (error) {
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("site_sessions").insert({
      organization_id: workspace.organizationId,
      project_id: projectId,
      membership_id: workspace.membershipId,
      work_on: today,
      started_at: new Date().toISOString(),
      created_by: workspace.userId,
      updated_by: workspace.userId,
    });
    if (error) {
      return { error: error.message };
    }
  }
  revalidatePath("/");
  return null;
}

export async function endSiteAction(projectId: string): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "capture.create")) {
    return { error: "現場終了の権限がありません。" };
  }
  const supabase = await createServerSupabaseClient();
  const today = tokyoTodayIso();
  const { error } = await supabase
    .from("site_sessions")
    .update({ ended_at: new Date().toISOString(), updated_by: workspace.userId })
    .eq("project_id", projectId)
    .eq("membership_id", workspace.membershipId)
    .eq("work_on", today)
    .is("deleted_at", null);
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/");
  return null;
}
