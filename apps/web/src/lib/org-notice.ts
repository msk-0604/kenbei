import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendExpoPushToMember } from "@/lib/push";
import { isWebPushConfigured, sendWebPush } from "@/lib/push/web-push";
import type { PushPayload } from "@/lib/push/events";
import type { Workspace } from "@/lib/session";

export type OrgNoticeInput = {
  projectId?: string | null;
  kind: string;
  title: string;
  body?: string | null;
  href?: string | null;
  /** 同じキーは同じ人に2回届かない。省略時は毎回新しいお知らせ。 */
  dedupeKey?: string | null;
  /** 操作した本人にも届ける（現場を完了にしたときだけ） */
  includeActor?: boolean;
  /** ロック画面に出す文面。省略時は title / body を使う。 */
  push?: PushPayload;
};

/**
 * 会社のメンバー（共通ログインの作業員を含む）へ、アプリ内のお知らせとプッシュ通知を送る。
 * 宛先は DB 側（post_org_notice）で決まる：本人は除く・現場を見られる人だけ・重複なし。
 * お知らせの失敗で主な操作を止めないよう、例外は投げずに結果だけ返す。
 */
export async function postOrgNotice(
  workspace: Workspace,
  input: OrgNoticeInput,
): Promise<{ ok: boolean; recipients: string[] }> {
  if (!workspace.organizationId) {
    return { ok: false, recipients: [] };
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("post_org_notice", {
    p_organization_id: workspace.organizationId,
    p_project_id: input.projectId ?? null,
    p_kind: input.kind,
    p_title: input.title,
    p_body: input.body ?? null,
    p_href: input.href ?? null,
    p_dedupe_key: input.dedupeKey ?? null,
    p_include_actor: input.includeActor ?? false,
  });
  if (error) {
    return { ok: false, recipients: [] };
  }
  const recipients = ((data as string[] | null) ?? []).filter(Boolean);
  if (recipients.length > 0) {
    const payload: PushPayload = input.push ?? {
      title: "KENBEI",
      body: [input.title, input.body].filter(Boolean).join("：").slice(0, 180),
      url: input.href ?? "/today",
      tag: input.dedupeKey ?? input.kind,
    };
    await deliverPush(workspace.organizationId, recipients, payload, input);
  }
  return { ok: true, recipients };
}

async function deliverPush(
  organizationId: string,
  profileIds: string[],
  payload: PushPayload,
  input: OrgNoticeInput,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return;
  }

  if (isWebPushConfigured()) {
    const { data } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, profile_id, organization_id")
      .eq("organization_id", organizationId)
      .in("profile_id", profileIds);
    const rows =
      (data as
        | { id: string; endpoint: string; p256dh: string; auth: string; profile_id: string; organization_id: string }[]
        | null) ?? [];
    const gone: string[] = [];
    const used: string[] = [];
    await Promise.all(
      rows
        .filter((row) => row.organization_id === organizationId && profileIds.includes(row.profile_id))
        .map(async (row) => {
          const result = await sendWebPush(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
            payload,
          );
          if (result === "ok") {
            used.push(row.id);
          } else if (result === "gone") {
            gone.push(row.id);
          }
        }),
    );
    if (gone.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", gone);
    }
    if (used.length > 0) {
      await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("id", used);
    }
  }

  // スマホアプリ（Expo）の端末にも届ける
  await Promise.all(
    profileIds.map((profileId) =>
      sendExpoPushToMember({
        organizationId,
        profileId,
        title: input.title,
        body: input.body ?? undefined,
        data: {
          kind: input.kind,
          href: payload.url ?? input.href ?? "",
          projectId: input.projectId ?? "",
        },
      }),
    ),
  );
}
