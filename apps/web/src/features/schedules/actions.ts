"use server";

import { requireWorkspace, isSiteAdmin } from "@/lib/authz-guard";
import { isIsoDate } from "@/lib/site-dates";
import { postOrgNotice } from "@/lib/org-notice";
import { buildPushPayload } from "@/lib/push/events";
import { scheduleNoticeDedupeKey } from "@/lib/site-rules";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDaySites } from "@/features/sites/queries";
import type { DaySite } from "@/features/sites/types";

export async function loadDaySitesAction(date: string): Promise<{ sites: DaySite[] } | { error: string }> {
  await requireWorkspace();
  if (!isIsoDate(date)) {
    return { error: "日付が正しくありません。" };
  }
  try {
    return { sites: await getDaySites(date) };
  } catch {
    return { error: "読み込みに失敗しました。もう一度お試しください。" };
  }
}

/** 予定を登録・変更したあと、会社のメンバーへ知らせる（予定そのものは保存済み） */
export async function notifyScheduleChangeAction(input: {
  scheduleIds: string[];
  revision: string;
  kind: "schedule_created" | "schedule_updated";
}): Promise<{ ok: boolean }> {
  const workspace = await requireWorkspace();
  if (!isSiteAdmin(workspace) || input.scheduleIds.length === 0) {
    return { ok: false };
  }
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("schedules")
    .select("id, project_id, group_id, schedule_date, projects(name)")
    .eq("organization_id", workspace.organizationId)
    .in("id", input.scheduleIds.slice(0, 50));
  const rows =
    (data as
      | { id: string; project_id: string; group_id: string | null; schedule_date: string; projects: { name: string } | { name: string }[] | null }[]
      | null) ?? [];
  const first = rows[0];
  if (!first) {
    return { ok: false };
  }
  const project = Array.isArray(first.projects) ? first.projects[0] : first.projects;
  const siteName = project?.name ?? "現場";
  const payload = buildPushPayload({
    event: input.kind,
    actorName: workspace.displayName,
    siteName,
    siteId: first.project_id,
    scheduleId: first.id,
  });
  payload.url = `/today?date=${first.schedule_date}`;
  const result = await postOrgNotice(workspace, {
    projectId: first.project_id,
    kind: input.kind,
    title: input.kind === "schedule_created" ? "予定が登録されました" : "予定が変更されました",
    body: siteName,
    href: payload.url,
    dedupeKey: scheduleNoticeDedupeKey(first.group_id ?? first.id, input.revision),
    push: payload,
  });
  return { ok: result.ok };
}
