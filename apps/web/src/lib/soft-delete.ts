import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * 論理削除（deleted_at を入れる）。
 * 一覧の SELECT ポリシーが deleted_at IS NULL の行しか見せないため、利用者の権限のままの UPDATE は
 * RLS に止められる。呼ぶ側で「本人が見られる行か・消してよい人か」を確かめてから、サーバーの権限で更新する。
 */
export async function softDeleteRow(
  table: "photos" | "daily_reports" | "project_tasks",
  id: string,
  organizationId: string,
  deletedBy: string,
): Promise<{ error: string } | null> {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return { error: "サーバーの設定が足りないため、いまは消せません。お問い合わせください。" };
  }
  const now = new Date().toISOString();
  const patch: Record<string, string> = { deleted_at: now, updated_at: now };
  if (table !== "photos") {
    patch.updated_by = deletedBy;
  }
  const { error } = await admin
    .from(table)
    .update(patch)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  return error ? { error: "消せませんでした。通信を確認して、もう一度お試しください。" } : null;
}
