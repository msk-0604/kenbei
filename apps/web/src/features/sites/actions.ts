"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertOrganizationWritable, isSiteAdmin, requireWorkspace } from "@/lib/authz-guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isIsoDate } from "@/lib/site-dates";
import { postOrgNotice } from "@/lib/org-notice";
import { buildPushPayload } from "@/lib/push/events";
import {
  SITE_FORM_STATUSES,
  becameCompleted,
  isSiteStatus,
  isWorkDuration,
  oneOffScheduleDates,
  processNoticeDedupeKey,
  siteCompletedDedupeKey,
  siteNoticeDedupeKey,
  type SiteStatus,
  type WorkDuration,
} from "@/lib/site-rules";
import { getProgressPresets } from "@/features/sites/queries";
import type { Workspace } from "@/lib/session";

export type SiteFormInput = {
  id?: string;
  notify?: boolean;
  name: string;
  address: string;
  manager_name: string;
  prime_contractor_name: string;
  customer_name: string;
  work_type: string;
  caution: string;
  start_date: string;
  end_date: string;
  status: string;
  memo: string;
  work_duration: string;
};

export type SiteSaveResult =
  | { ok: true; id: string; name: string; noticeError: boolean }
  | { ok: false; error: string };

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function cleanDate(value: unknown): string | null {
  return typeof value === "string" && isIsoDate(value.trim()) ? value.trim() : null;
}

type CleanSite = {
  name: string;
  address: string | null;
  manager_name: string | null;
  prime_contractor_name: string | null;
  customer_name: string | null;
  work_type: string | null;
  caution: string | null;
  start_date: string | null;
  end_date: string | null;
  status: SiteStatus;
  memo: string | null;
  work_duration: WorkDuration | null;
};

function buildSite(input: SiteFormInput, previousStatus?: SiteStatus): { site?: CleanSite; error?: string } {
  const name = clean(input.name, 200);
  if (!name) {
    return { error: "現場名（会社/依頼元）を入力してください" };
  }
  const start_date = cleanDate(input.start_date);
  const end_date = cleanDate(input.end_date);
  if (start_date && end_date && start_date > end_date) {
    return { error: "完了予定日は着工日と同じか、それより後にしてください" };
  }
  // フォームで選べるのは仮予定／進行中／完了。一時停止・中止の現場は、変えない限りそのまま。
  const allowed: readonly string[] = previousStatus ? [...SITE_FORM_STATUSES, previousStatus] : SITE_FORM_STATUSES;
  const status: SiteStatus =
    isSiteStatus(input.status) && allowed.includes(input.status) ? input.status : (previousStatus ?? "draft");
  return {
    site: {
      name,
      address: clean(input.address, 500),
      manager_name: clean(input.manager_name, 100),
      prime_contractor_name: clean(input.prime_contractor_name, 200),
      customer_name: clean(input.customer_name, 200),
      work_type: clean(input.work_type, 50),
      caution: clean(input.caution, 2000),
      start_date,
      end_date,
      status,
      memo: clean(input.memo, 2000),
      work_duration: isWorkDuration(input.work_duration) ? input.work_duration : null,
    },
  };
}

async function upsertCustomer(
  supabase: SupabaseClient,
  workspace: Workspace,
  name: string | null,
): Promise<string | null> {
  if (!name) {
    return null;
  }
  const existing = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", workspace.organizationId)
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
      organization_id: workspace.organizationId,
      name,
      created_by: workspace.userId,
      updated_by: workspace.userId,
    })
    .select("id")
    .maybeSingle();
  return (inserted.data as { id: string } | null)?.id ?? null;
}

async function savePrimaryAddress(
  supabase: SupabaseClient,
  workspace: Workspace,
  projectId: string,
  address: string | null,
): Promise<void> {
  const existing = await supabase
    .from("project_sites")
    .select("id")
    .eq("organization_id", workspace.organizationId)
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
    return;
  }
  if (address) {
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

function projectColumns(site: CleanSite, customerId: string | null, workspace: Workspace) {
  return {
    name: site.name,
    status: site.status,
    customer_id: customerId,
    work_summary: site.work_type,
    caution_note: site.caution,
    planned_start_on: site.start_date,
    planned_end_on: site.end_date,
    manager_name: site.manager_name,
    prime_contractor_name: site.prime_contractor_name,
    memo: site.memo,
    work_duration: site.work_duration,
    updated_by: workspace.userId,
  };
}

async function announceNewSite(workspace: Workspace, siteId: string, siteName: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  await supabase
    .from("projects")
    .update({ published_at: new Date().toISOString() })
    .eq("id", siteId)
    .eq("organization_id", workspace.organizationId)
    .is("published_at", null);
  const result = await postOrgNotice(workspace, {
    projectId: siteId,
    kind: "site_created",
    title: "新しい現場が追加されました",
    body: siteName,
    href: `/sites/${siteId}`,
    dedupeKey: siteNoticeDedupeKey(siteId),
    push: buildPushPayload({ event: "site_created", actorName: workspace.displayName, siteName, siteId }),
  });
  return result.ok;
}

/** 完了以外 → 完了 になった瞬間だけ。完了させた本人（管理者）にも届く唯一のお知らせ。 */
async function announceCompleted(workspace: Workspace, siteId: string, siteName: string, completedAt: string | null) {
  await postOrgNotice(workspace, {
    projectId: siteId,
    kind: "site_completed",
    title: "現場が完了しました",
    body: siteName,
    href: `/sites/${siteId}`,
    dedupeKey: siteCompletedDedupeKey(siteId, completedAt ?? new Date().toISOString()),
    includeActor: true,
    push: buildPushPayload({
      event: "site_status_changed",
      actorName: workspace.displayName,
      siteName,
      siteId,
      statusLabel: "完了",
    }),
  });
}

function revalidateSite(siteId?: string) {
  revalidatePath("/sites");
  revalidatePath("/today");
  revalidatePath("/kanri");
  if (siteId) {
    revalidatePath(`/sites/${siteId}`);
  }
}

async function requireWritableAdmin(): Promise<Workspace | { error: string }> {
  const workspace = await requireWorkspace();
  if (!isSiteAdmin(workspace)) {
    return { error: "現場の登録・変更は管理者だけができます" };
  }
  const locked = await assertOrganizationWritable(workspace.organizationId);
  return locked ?? workspace;
}

/** 現場の登録（POST）と変更（PATCH）。notify=true は「登録して全員に知らせる」。 */
export async function saveSiteAction(input: SiteFormInput): Promise<SiteSaveResult> {
  const workspace = await requireWritableAdmin();
  if ("error" in workspace) {
    return { ok: false, error: workspace.error };
  }
  const supabase = await createServerSupabaseClient();

  if (input.id) {
    const previousRes = await supabase
      .from("projects")
      .select("id, status")
      .eq("id", input.id)
      .eq("organization_id", workspace.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    const previous = previousRes.data as { id: string; status: string } | null;
    if (!previous) {
      return { ok: false, error: "現場が見つかりません" };
    }
    const previousStatus = isSiteStatus(previous.status) ? previous.status : "active";
    const built = buildSite(input, previousStatus);
    if (!built.site) {
      return { ok: false, error: built.error ?? "入力が正しくありません" };
    }
    const customerId = await upsertCustomer(supabase, workspace, built.site.customer_name);
    // completed_at は DB のトリガーが状態の変化から決める
    const { data, error } = await supabase
      .from("projects")
      .update(projectColumns(built.site, customerId, workspace))
      .eq("id", input.id)
      .eq("organization_id", workspace.organizationId)
      .select("id, name, status, completed_at")
      .maybeSingle();
    const saved = data as { id: string; name: string; status: string; completed_at: string | null } | null;
    if (error || !saved) {
      return { ok: false, error: "現場の更新に失敗しました。もう一度お試しください。" };
    }
    await savePrimaryAddress(supabase, workspace, saved.id, built.site.address);

    let noticeError = false;
    if (input.notify) {
      noticeError = !(await announceNewSite(workspace, saved.id, saved.name));
    } else {
      await postOrgNotice(workspace, {
        projectId: saved.id,
        kind: "site_updated",
        title: "現場の情報が変更されました",
        body: saved.name,
        href: `/sites/${saved.id}`,
        push: buildPushPayload({
          event: "site_updated",
          actorName: workspace.displayName,
          siteName: saved.name,
          siteId: saved.id,
        }),
      });
    }
    if (becameCompleted(previous.status, saved.status)) {
      await announceCompleted(workspace, saved.id, saved.name, saved.completed_at);
    }
    revalidateSite(saved.id);
    return { ok: true, id: saved.id, name: saved.name, noticeError };
  }

  const built = buildSite(input);
  if (!built.site) {
    return { ok: false, error: built.error ?? "入力が正しくありません" };
  }
  const customerId = await upsertCustomer(supabase, workspace, built.site.customer_name);
  const inserted = await supabase
    .from("projects")
    .insert({
      organization_id: workspace.organizationId,
      ...projectColumns(built.site, customerId, workspace),
      created_by: workspace.userId,
    })
    .select("id, name")
    .maybeSingle();
  const created = inserted.data as { id: string; name: string } | null;
  if (inserted.error || !created) {
    return { ok: false, error: "現場の保存に失敗しました。もう一度お試しください。" };
  }
  await savePrimaryAddress(supabase, workspace, created.id, built.site.address);
  await supabase.from("project_members").insert({
    organization_id: workspace.organizationId,
    project_id: created.id,
    membership_id: workspace.membershipId,
    role_in_project: "supervisor",
    status: "active",
    created_by: workspace.userId,
    updated_by: workspace.userId,
  });

  // 単発の現場：着工日〜完了予定日の予定を1日1行で作る（作業員は未割当）。長期は作らない。
  const dates = oneOffScheduleDates(built.site.work_duration, built.site.start_date, built.site.end_date);
  if (dates.length > 0) {
    await supabase.from("schedules").insert(
      dates.map((schedule_date) => ({
        organization_id: workspace.organizationId,
        project_id: created.id,
        schedule_date,
        worker_id: null,
        status: "scheduled",
        time_kind: "unset",
        work_content: built.site?.work_type ?? null,
      })),
    );
  }

  let noticeError = false;
  if (input.notify) {
    noticeError = !(await announceNewSite(workspace, created.id, created.name));
  }
  revalidateSite(created.id);
  return { ok: true, id: created.id, name: created.name, noticeError };
}

/** 作業工程が100%になったときの「この現場を完了にする」（進行中／完了だけ受け付ける） */
export async function setSiteStatusAction(
  siteId: string,
  status: "active" | "completed",
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const workspace = await requireWritableAdmin();
  if ("error" in workspace) {
    return { ok: false, error: workspace.error };
  }
  if (status !== "active" && status !== "completed") {
    return { ok: false, error: "入力が正しくありません" };
  }
  const supabase = await createServerSupabaseClient();
  const previousRes = await supabase
    .from("projects")
    .select("status")
    .eq("id", siteId)
    .eq("organization_id", workspace.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  const previous = previousRes.data as { status: string } | null;
  if (!previous) {
    return { ok: false, error: "現場が見つかりません" };
  }
  const { data, error } = await supabase
    .from("projects")
    .update({ status, updated_by: workspace.userId })
    .eq("id", siteId)
    .eq("organization_id", workspace.organizationId)
    .select("id, name, status, completed_at")
    .maybeSingle();
  const saved = data as { id: string; name: string; status: string; completed_at: string | null } | null;
  if (error || !saved) {
    return { ok: false, error: "更新に失敗しました。もう一度お試しください。" };
  }
  if (becameCompleted(previous.status, saved.status)) {
    await announceCompleted(workspace, saved.id, saved.name, saved.completed_at);
  }
  revalidateSite(saved.id);
  return { ok: true, status: saved.status };
}

/** 現場を削除する（予定と作業工程も消す。写真・日報の記録は残す） */
export async function deleteSiteAction(siteId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const workspace = await requireWritableAdmin();
  if ("error" in workspace) {
    return { ok: false, error: workspace.error };
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString(), updated_by: workspace.userId })
    .eq("id", siteId)
    .eq("organization_id", workspace.organizationId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "削除に失敗しました。もう一度お試しください。" };
  }
  await supabase.from("schedules").delete().eq("organization_id", workspace.organizationId).eq("project_id", siteId);
  await supabase
    .from("project_progress_items")
    .delete()
    .eq("organization_id", workspace.organizationId)
    .eq("project_id", siteId);
  revalidateSite();
  return { ok: true };
}

export async function resendSiteNoticeAction(siteId: string): Promise<{ ok: boolean }> {
  const workspace = await requireWorkspace();
  if (!isSiteAdmin(workspace)) {
    return { ok: false };
  }
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", siteId)
    .eq("organization_id", workspace.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  const site = data as { id: string; name: string } | null;
  if (!site) {
    return { ok: false };
  }
  return { ok: await announceNewSite(workspace, site.id, site.name) };
}

/** 工程を追加・削除したことを、ほかのメンバーへ知らせる（工程そのものは保存済み） */
export async function notifyProcessChangeAction(siteId: string, actionKey: string): Promise<{ ok: boolean }> {
  const workspace = await requireWorkspace();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", siteId)
    .eq("organization_id", workspace.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  const site = data as { id: string; name: string } | null;
  if (!site) {
    return { ok: false };
  }
  const payload = buildPushPayload({
    event: "progress_updated",
    actorName: workspace.displayName,
    siteName: site.name,
    siteId: site.id,
  });
  const result = await postOrgNotice(workspace, {
    projectId: site.id,
    kind: "progress_updated",
    title: "現場の工程が変更されました",
    body: site.name,
    href: `/sites/${site.id}/progress`,
    dedupeKey: processNoticeDedupeKey(site.id, actionKey),
    push: payload,
  });
  return { ok: result.ok };
}

/** 工程がまだない現場に「よく使う項目」（会社ごとの候補、なければ標準）をまとめて入れる */
export async function seedProgressItemsAction(
  siteId: string,
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const workspace = await requireWorkspace();
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("project_progress_items")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", workspace.organizationId)
    .eq("project_id", siteId);
  if (count && count > 0) {
    return { ok: true, created: 0 };
  }
  const { items } = await getProgressPresets();
  const { error } = await supabase.from("project_progress_items").insert(
    items.map((item, index) => ({
      organization_id: workspace.organizationId,
      project_id: siteId,
      category: item.category,
      section: item.section,
      item_name: item.item_name,
      sort_order: index,
    })),
  );
  if (error) {
    return { ok: false, error: "作成に失敗しました。もう一度お試しください。" };
  }
  revalidatePath(`/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}/progress`);
  return { ok: true, created: items.length };
}
