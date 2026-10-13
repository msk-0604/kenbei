import { NextResponse } from "next/server";
import { getWorkspace, hasOrganization } from "@/lib/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { postOrgNotice } from "@/lib/org-notice";
import { buildPushPayload, isPushEventType } from "@/lib/push/events";
import { siteStatusLabel } from "@/lib/site-rules";
import { CREW_ROLE_CODE } from "@kensapo/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOTICE_TITLES: Record<string, string> = {
  schedule_cancelled: "予定が取り消されました",
  work_started: "作業が始まりました",
  work_ended: "作業が終わりました",
  worker_created: "作業員が登録されました",
  worker_updated: "作業員の情報が変わりました",
  progress_ok: "工程が〇になりました",
  progress_attention: "工程が△になりました",
  progress_remarks: "工程に備考が書かれました",
  site_status_changed: "現場の状態が変わりました",
};

type EventBody = {
  event?: string;
  siteId?: string;
  itemId?: string;
  scheduleId?: string;
  photoCount?: number;
  status?: string;
  actorName?: string;
};

/**
 * 画面で保存したあとの「ほかの人へのお知らせ」。会社はログイン情報から決め、
 * 対象の現場・予定・工程が自分の会社のものかを確かめてから送る。本人には届かない。
 */
export async function POST(request: Request) {
  const workspace = await getWorkspace();
  if (!workspace || !hasOrganization(workspace)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as EventBody | null;
  if (!body || !isPushEventType(body.event)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
  const event = body.event;
  const supabase = await createServerSupabaseClient();
  const org = workspace.organizationId;

  let siteId = typeof body.siteId === "string" ? body.siteId : "";
  let itemName = "";
  let scheduleDate = "";
  const itemId = typeof body.itemId === "string" ? body.itemId : "";
  const scheduleId = typeof body.scheduleId === "string" ? body.scheduleId : "";

  if (itemId) {
    const { data } = await supabase
      .from("project_progress_items")
      .select("item_name, project_id")
      .eq("id", itemId)
      .eq("organization_id", org)
      .maybeSingle();
    const item = data as { item_name: string; project_id: string } | null;
    if (!item) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    itemName = item.item_name;
    siteId = item.project_id;
  }
  if (scheduleId && event !== "schedule_cancelled") {
    const { data } = await supabase
      .from("schedules")
      .select("project_id, schedule_date")
      .eq("id", scheduleId)
      .eq("organization_id", org)
      .maybeSingle();
    const schedule = data as { project_id: string; schedule_date: string } | null;
    if (!schedule) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    siteId = schedule.project_id;
    scheduleDate = schedule.schedule_date;
  }

  let siteName = "";
  if (siteId) {
    const { data } = await supabase
      .from("projects")
      .select("name")
      .eq("id", siteId)
      .eq("organization_id", org)
      .maybeSingle();
    const site = data as { name: string } | null;
    if (!site) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    siteName = site.name;
  } else if (event !== "worker_created" && event !== "worker_updated") {
    return NextResponse.json({ error: "Missing target" }, { status: 400 });
  }

  // 共通ログインの端末は、端末で選んだ名前を「誰が」に使う（表示だけ。権限には使わない）
  const deviceName = typeof body.actorName === "string" ? body.actorName.replace(/\s+/g, " ").trim().slice(0, 20) : "";
  const actorName = workspace.roleCode === CREW_ROLE_CODE && deviceName ? deviceName : workspace.displayName;
  const photoCount = Number(body.photoCount);
  const payload = buildPushPayload({
    event,
    actorName,
    siteName,
    itemName,
    statusLabel: typeof body.status === "string" ? siteStatusLabel(body.status) : undefined,
    photoCount: Number.isFinite(photoCount) ? photoCount : 1,
    siteId: siteId || undefined,
    itemId: itemId || undefined,
    scheduleId: scheduleId || undefined,
  });
  if (scheduleDate) {
    payload.url = `/today?date=${scheduleDate}`;
  }

  const result = await postOrgNotice(workspace, {
    projectId: siteId || null,
    kind: event,
    title: NOTICE_TITLES[event] ?? "更新がありました",
    body: payload.body,
    href: payload.url,
    push: payload,
  });
  return NextResponse.json({ ok: result.ok, sent: result.recipients.length });
}
