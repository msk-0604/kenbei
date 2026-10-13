import { TodayBoard } from "@/features/schedules/today-board";
import { TodayMonthCalendar } from "@/features/schedules/today-month-calendar";
import { getScheduleCountsForRange, getTodayVisits } from "@/features/sites/queries";
import { isCrewLogin, requireWorkspace } from "@/lib/authz-guard";
import { addDaysISO, clampDateISO, formatDateWithWeekday, getMonthMatrixSundayISO, todayISO } from "@/lib/site-dates";

export const dynamic = "force-dynamic";

/** ログイン後の最初の画面。日付切り替え・自分の予定／全員の予定・作業開始と終了・月のカレンダー。 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const workspace = await requireWorkspace();
  const params = await searchParams;
  const today = todayISO();
  const date = clampDateISO(params.date ?? today);

  const monthDates = getMonthMatrixSundayISO(date);
  const [visits, scheduleCounts] = await Promise.all([
    getTodayVisits(date).catch(() => []),
    getScheduleCountsForRange(monthDates[0] ?? date, monthDates[monthDates.length - 1] ?? date).catch(
      () => ({}) as Record<string, number>,
    ),
  ]);

  return (
    <>
      <TodayBoard
        dateLabel={formatDateWithWeekday(date)}
        prevDate={addDaysISO(date, -1)}
        nextDate={addDaysISO(date, 1)}
        isToday={date === today}
        visits={visits}
        usesDeviceName={isCrewLogin(workspace)}
        accountName={workspace.displayName}
        membershipId={workspace.membershipId}
      />
      <TodayMonthCalendar selectedDate={date} monthDates={monthDates} scheduleCounts={scheduleCounts} />
    </>
  );
}
