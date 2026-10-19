import "server-only";

import { tokyoTodayIso } from "@/lib/dates";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type KanriTodayStats = {
  /** 今日の予定（件） */
  schedulesToday: number;
  /** 今日、作業開始を押した予定（件） */
  startedToday: number;
  /** この7日間に撮った写真（枚） */
  photos7d: number;
  /** この7日間の日報（件） */
  reports7d: number;
};

/** 管理画面の上に出す「今日の現場」の数字。読めないものは 0 として出す。 */
export async function getKanriTodayStats(organizationId: string, now = new Date()): Promise<KanriTodayStats> {
  const supabase = await createServerSupabaseClient();
  const head = { count: "exact" as const, head: true };
  const today = tokyoTodayIso(now);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const weekAgoDate = tokyoTodayIso(weekAgo);
  const [schedules, started, photos, reports] = await Promise.all([
    supabase.from("schedules").select("id", head).eq("organization_id", organizationId).eq("schedule_date", today),
    supabase
      .from("schedules")
      .select("id", head)
      .eq("organization_id", organizationId)
      .eq("schedule_date", today)
      .not("actual_start_time", "is", null),
    supabase
      .from("photos")
      .select("id", head)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("created_at", weekAgo.toISOString()),
    supabase
      .from("daily_reports")
      .select("id", head)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("work_on", weekAgoDate),
  ]);
  return {
    schedulesToday: schedules.count ?? 0,
    startedToday: started.count ?? 0,
    photos7d: photos.count ?? 0,
    reports7d: reports.count ?? 0,
  };
}
