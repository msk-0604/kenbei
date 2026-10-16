import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ActionHint } from "@/components/ui/action-hint";
import { EmptyState } from "@/components/ui/empty-state";
import { ScheduleMonthCalendar } from "@/features/schedules/schedule-month-calendar";
import { ScheduleDayTable } from "@/features/schedules/schedule-day-table";
import { ScheduleDayList } from "@/features/schedules/schedule-day-list";
import { ScheduleDetailsSkeleton } from "@/features/schedules/schedule-skeleton";
import { DayScheduleSection } from "@/features/schedules/day-schedule-section";
import {
  getScheduleCountsForRange,
  getSchedulesForDate,
  listSites,
  listWorkers,
  toSiteOptions,
} from "@/features/sites/queries";
import { isSiteAdmin, requireWorkspace } from "@/lib/authz-guard";
import { clampDateISO, formatDate, getMonthMatrixISO, todayISO } from "@/lib/site-dates";

export const dynamic = "force-dynamic";

async function ScheduleDetails({ selectedDate }: { selectedDate: string }) {
  const workspace = await requireWorkspace();
  const isAdmin = isSiteAdmin(workspace);
  const monthDates = getMonthMatrixISO(selectedDate);
  const isToday = selectedDate === todayISO();

  const [schedules, scheduleCounts, workers, sites] = await Promise.all([
    getSchedulesForDate(selectedDate),
    getScheduleCountsForRange(monthDates[0] ?? selectedDate, monthDates[monthDates.length - 1] ?? selectedDate),
    listWorkers(),
    listSites(),
  ]);
  const projects = toSiteOptions(sites);

  return (
    <>
      <ScheduleMonthCalendar selectedDate={selectedDate} monthDates={monthDates} scheduleCounts={scheduleCounts} />

      {isAdmin ? (
        <section className="mb-6">
          <Link href="/workers">
            <Button variant="secondary" fullWidth size="md">
              作業員の登録・一覧を見る
            </Button>
          </Link>
        </section>
      ) : null}

      <DayScheduleSection>
        {schedules.length === 0 && projects.length > 0 ? (
          <EmptyState
            title={isToday ? "今日の予定はまだありません" : "この日の予定はありません"}
            description={isAdmin ? "上のボタンから、行動予定を登録できます。" : "まだ予定が登録されていません。"}
          />
        ) : null}

        <ScheduleDayTable schedules={schedules} />

        {isAdmin && projects.length === 0 ? (
          <EmptyState
            title="予定を登録する準備ができていません"
            description="現場を先に登録してください。"
            action={
              <Link href="/sites/new">
                <Button fullWidth>現場を登録する</Button>
              </Link>
            }
          />
        ) : (
          <ScheduleDayList
            schedules={schedules}
            organizationId={workspace.organizationId}
            workers={workers}
            projects={projects}
            selectedDate={selectedDate}
            canManage={isAdmin}
          />
        )}
      </DayScheduleSection>
    </>
  );
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const workspace = await requireWorkspace();
  const isAdmin = isSiteAdmin(workspace);
  const selectedDate = clampDateISO(params.date);
  const isToday = selectedDate === todayISO();

  return (
    <>
      <PageHeader
        title="作業予定"
        description={isToday ? `今日（${formatDate(selectedDate)}）の予定` : `${formatDate(selectedDate)}の予定`}
        backHref={isAdmin ? "/kanri" : "/today"}
        backLabel={isAdmin ? "管理に戻る" : "前の画面に戻る"}
      />

      {isAdmin ? (
        <section className="mb-6">
          <Link href={`/schedule/new?date=${selectedDate}`}>
            <Button fullWidth size="md">
              新しい予定を追加する
            </Button>
          </Link>
          <ActionHint>日付・現場・作業員を選んで登録します</ActionHint>
        </section>
      ) : null}

      <Suspense key={selectedDate} fallback={<ScheduleDetailsSkeleton />}>
        <ScheduleDetails selectedDate={selectedDate} />
      </Suspense>
    </>
  );
}
