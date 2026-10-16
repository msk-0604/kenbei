/** 通知の種類と、ロック画面に出す文面（kenbei-alpha と同じ文面）。 */

export const PUSH_EVENTS = [
  "site_created",
  "site_updated",
  "site_status_changed",
  "progress_added",
  "progress_updated",
  "progress_ok",
  "progress_attention",
  "progress_remarks",
  "photo_added",
  "schedule_created",
  "schedule_updated",
  "schedule_cancelled",
  "work_started",
  "work_ended",
  "worker_created",
  "worker_updated",
] as const;

export type PushEventType = (typeof PUSH_EVENTS)[number];

export function isPushEventType(value: unknown): value is PushEventType {
  return (
    typeof value === "string" &&
    (PUSH_EVENTS as readonly string[]).includes(value)
  );
}

export type PushEventInput = {
  event: PushEventType;
  actorName: string;
  siteName?: string;
  itemName?: string;
  statusLabel?: string;
  photoCount?: number;
  siteId?: string;
  itemId?: string;
  scheduleId?: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

function clip(value: string, max: number): string {
  const t = value.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function who(actorName: string): string {
  return clip(actorName, 20) || "メンバー";
}

function site(siteName?: string): string {
  const n = clip(siteName ?? "", 30);
  return n ? `「${n}」` : "現場";
}

function item(itemName?: string): string {
  const n = clip(itemName ?? "", 24);
  return n ? `「${n}」` : "作業工程";
}

export function eventUrl(input: PushEventInput): string {
  const siteId = input.siteId ?? "";
  switch (input.event) {
    case "progress_added":
    case "progress_updated":
    case "progress_ok":
    case "progress_attention":
    case "progress_remarks":
      return siteId ? `/sites/${siteId}/progress` : "/sites";
    case "photo_added":
      return siteId ? `/sites/${siteId}/photos` : "/sites";
    case "schedule_created":
    case "schedule_updated":
    case "schedule_cancelled":
    case "work_started":
    case "work_ended":
      return "/today";
    case "worker_created":
    case "worker_updated":
      return "/workers";
    default:
      return siteId ? `/sites/${siteId}` : "/sites";
  }
}

export function eventTag(input: PushEventInput): string {
  const parts = [
    input.event,
    input.siteId || "",
    input.itemId || input.scheduleId || "",
  ];
  return clip(parts.join("-"), 80) || input.event;
}

export function buildPushPayload(input: PushEventInput): PushPayload {
  const actor = who(input.actorName);
  const siteLabel = site(input.siteName);
  const itemLabel = item(input.itemName);
  const count = Math.min(99, Math.max(1, Number(input.photoCount) || 1));
  const status = clip(input.statusLabel ?? "", 12) || "完了";

  let body = `${actor}さんが更新しました。`;
  switch (input.event) {
    case "site_created":
      body = `新しい現場が追加されました：${clip(input.siteName ?? "", 30) || "現場"}`;
      break;
    case "site_updated":
      body = `${actor}さんが${siteLabel}の情報を変更しました。`;
      break;
    case "site_status_changed":
      body = `${actor}さんが${siteLabel}を「${status}」にしました。`;
      break;
    case "progress_added":
      body = `${actor}さんが${siteLabel}に${itemLabel}を追加しました。`;
      break;
    case "progress_updated":
      body = `${actor}さんが${siteLabel}の作業工程を更新しました。`;
      break;
    case "progress_ok":
      body = `${actor}さんが${siteLabel}の${itemLabel}を〇にしました。`;
      break;
    case "progress_attention":
      body = `${actor}さんが${siteLabel}の${itemLabel}を△にしました。`;
      break;
    case "progress_remarks":
      body = `${actor}さんが${siteLabel}の作業工程に備考を書きました。`;
      break;
    case "photo_added":
      body =
        count > 1
          ? `${actor}さんが${siteLabel}に写真を${count}枚追加しました。`
          : `${actor}さんが${siteLabel}に写真を追加しました。`;
      break;
    case "schedule_created":
      body = `${actor}さんが${siteLabel}の予定を登録しました。`;
      break;
    case "schedule_updated":
      body = `${actor}さんが${siteLabel}の予定を変更しました。`;
      break;
    case "schedule_cancelled":
      body = `${actor}さんが${siteLabel}の予定を取り消しました。`;
      break;
    case "work_started":
      body = `${actor}さんが${siteLabel}で作業を開始しました。`;
      break;
    case "work_ended":
      body = `${actor}さんが${siteLabel}で作業を終了しました。`;
      break;
    case "worker_created":
      body = `${actor}さんが作業員を登録しました。`;
      break;
    case "worker_updated":
      body = `${actor}さんが作業員情報を更新しました。`;
      break;
  }

  return {
    title: "KENBEI",
    body: clip(body, 180),
    url: eventUrl(input),
    tag: eventTag(input),
  };
}
