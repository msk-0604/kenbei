"use server";

import { revalidatePath } from "next/cache";
import { assertOrganizationWritable, isSiteAdmin, requireWorkspace } from "@/lib/authz-guard";
import { addDaysISO, todayISO } from "@/lib/site-dates";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getProgressPresets } from "@/features/sites/queries";
import { SAMPLE_PREFIX, SAMPLE_SOURCE } from "@/features/help/sample-data";
import type { Workspace } from "@/lib/session";

async function requireSampleAdmin(): Promise<Workspace | { error: string }> {
  const workspace = await requireWorkspace();
  if (!isSiteAdmin(workspace)) {
    return { error: "管理者だけができます" };
  }
  const locked = await assertOrganizationWritable(workspace.organizationId);
  return locked ?? workspace;
}

function revalidateAll() {
  revalidatePath("/kanri");
  revalidatePath("/today");
  revalidatePath("/sites");
  revalidatePath("/workers");
}

/**
 * 見本の現場・作業員・今日と明日の予定を作る。実際の画面で動きを確かめてもらうため。
 * 「はじめにやること」の進み具合には数えない。お知らせも送らない。
 */
export async function createSampleDataAction(): Promise<void> {
  const workspace = await requireSampleAdmin();
  if ("error" in workspace) {
    return;
  }
  const supabase = await createServerSupabaseClient();
  const org = workspace.organizationId;

  const existing = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org)
    .eq("source", SAMPLE_SOURCE)
    .is("deleted_at", null);
  if ((existing.count ?? 0) > 0) {
    revalidateAll();
    return;
  }

  const today = todayISO();
  const workerRes = await supabase
    .from("workers")
    .insert({ organization_id: org, name: `${SAMPLE_PREFIX}田中 一郎`, trade: "見本", status: "active" })
    .select("id")
    .maybeSingle();
  const workerId = (workerRes.data as { id: string } | null)?.id ?? null;

  const siteRes = await supabase
    .from("projects")
    .insert({
      organization_id: org,
      name: `${SAMPLE_PREFIX}〇〇様邸 工事`,
      status: "active",
      work_summary: "見本の現場です。自由に触って、あとで消してください。",
      planned_start_on: today,
      planned_end_on: addDaysISO(today, 14),
      work_duration: "long_term",
      manager_name: workspace.displayName,
      source: SAMPLE_SOURCE,
      created_by: workspace.userId,
      updated_by: workspace.userId,
    })
    .select("id")
    .maybeSingle();
  const siteId = (siteRes.data as { id: string } | null)?.id;
  if (!siteId) {
    return;
  }
  await supabase.from("project_members").insert({
    organization_id: org,
    project_id: siteId,
    membership_id: workspace.membershipId,
    role_in_project: "supervisor",
    status: "active",
    created_by: workspace.userId,
    updated_by: workspace.userId,
  });
  await supabase.from("schedules").insert(
    [today, addDaysISO(today, 1)].map((schedule_date) => ({
      organization_id: org,
      project_id: siteId,
      worker_id: workerId,
      schedule_date,
      status: "scheduled",
      time_kind: "timed",
      scheduled_start_time: "08:30",
      scheduled_end_time: "17:00",
      work_content: "見本の予定（作業開始・終了を押してみてください）",
    })),
  );
  const { items } = await getProgressPresets();
  await supabase.from("project_progress_items").insert(
    items.slice(0, 10).map((item, index) => ({
      organization_id: org,
      project_id: siteId,
      category: item.category,
      section: item.section,
      item_name: item.item_name,
      sort_order: index,
    })),
  );
  revalidateAll();
}

/** 見本の現場（予定・工程ごと）と見本の作業員を消す */
export async function removeSampleDataAction(): Promise<void> {
  const workspace = await requireSampleAdmin();
  if ("error" in workspace) {
    return;
  }
  const supabase = await createServerSupabaseClient();
  const org = workspace.organizationId;
  const sites = await supabase
    .from("projects")
    .select("id")
    .eq("organization_id", org)
    .eq("source", SAMPLE_SOURCE)
    .is("deleted_at", null);
  const ids = ((sites.data as { id: string }[] | null) ?? []).map((row) => row.id);
  if (ids.length > 0) {
    await supabase.rpc("soft_delete_sites", { p_org_id: org, p_site_ids: ids });
  }
  await supabase.from("workers").delete().eq("organization_id", org).like("name", `${SAMPLE_PREFIX}%`);
  revalidateAll();
}
