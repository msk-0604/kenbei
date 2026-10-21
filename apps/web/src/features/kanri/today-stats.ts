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
  /** まだ終わっていない残作業（件） */
  openTasks: number;
};

/** 管理画面の上に出す「今日の現場」の数字。読めないものは 0 として出す。 */
export async function getKanriTodayStats(organizationId: string, now = new Date()): Promise<KanriTodayStats> {
  const supabase = await createServerSupabaseClient();
  const head = { count: "exact" as const, head: true };
  const today = tokyoTodayIso(now);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const weekAgoDate = tokyoTodayIso(weekAgo);
  const [schedules, started, photos, reports, tasks] = await Promise.all([
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
    supabase
      .from("project_tasks")
      .select("id", head)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .neq("status", "done"),
  ]);
  return {
    schedulesToday: schedules.count ?? 0,
    startedToday: started.count ?? 0,
    photos7d: photos.count ?? 0,
    reports7d: reports.count ?? 0,
    openTasks: tasks.count ?? 0,
  };
}

/** 今月（日本時間の1日から今日まで）の日報・写真・出面（作業開始を押した予定）の数 */
export async function getKanriMonthActivity(
  organizationId: string,
  now = new Date(),
): Promise<{ reports: number; photos: number; workdays: number }> {
  const supabase = await createServerSupabaseClient();
  const head = { count: "exact" as const, head: true };
  const today = tokyoTodayIso(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [reports, photos, workdays] = await Promise.all([
    supabase
      .from("daily_reports")
      .select("id", head)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("work_on", monthStart),
    supabase
      .from("photos")
      .select("id", head)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("created_at", `${monthStart}T00:00:00+09:00`),
    supabase
      .from("schedules")
      .select("id", head)
      .eq("organization_id", organizationId)
      .gte("schedule_date", monthStart)
      .not("worker_id", "is", null)
      .not("actual_start_time", "is", null),
  ]);
  return { reports: reports.count ?? 0, photos: photos.count ?? 0, workdays: workdays.count ?? 0 };
}
