"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { addMonthsISO, formatYearMonth, sameMonthISO, todayISO, weekdayIndex } from "@/lib/site-dates";
import { DaySitesPanel } from "@/features/schedules/day-sites-panel";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function weekdayColor(index: number, selected: boolean): string {
  if (selected) return "text-white";
  if (index === 0) return "text-red-600";
  if (index === 6) return "text-blue-600";
  return "text-navy-950";
}

export function TodayMonthCalendar({
  selectedDate,
  monthDates,
  scheduleCounts,
}: {
  selectedDate: string;
  monthDates: string[];
  scheduleCounts: Record<string, number>;
}) {
  const router = useRouter();
  const today = todayISO();
  const [peekDate, setPeekDate] = useState<string | null>(null);

  function goTo(date: string) {
    router.push(`/today?date=${date}`, { scroll: false });
  }

  function goMonth(offset: number) {
    goTo(addMonthsISO(selectedDate, offset));
  }

  return (
    <section className="mt-8 rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-xl font-bold text-gray-950">カレンダー</h2>

      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goMonth(-1)}
          className="tap-press min-h-[3.5rem] rounded-xl border-2 border-gray-200 shrink-0 whitespace-nowrap px-3 text-lg font-bold text-navy-900"
        >
          ‹ 前月
        </button>
        <p className="whitespace-nowrap text-center text-xl font-bold text-navy-950">
          {formatYearMonth(selectedDate)}
        </p>
        <button
          type="button"
          onClick={() => goMonth(1)}
          className="tap-press min-h-[3.5rem] rounded-xl border-2 border-gray-200 shrink-0 whitespace-nowrap px-3 text-lg font-bold text-navy-900"
        >
          翌月 ›
        </button>
      </div>

      <button
        type="button"
        onClick={() => goTo(today)}
        className="tap-press mb-4 min-h-[3rem] w-full rounded-xl bg-navy-900 px-4 text-lg font-bold text-white"
      >
        今日の日付に戻る
      </button>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((label, index) => (
          <div
            key={label}
            className={cn(
              "py-1 text-center text-base font-bold",
              index === 0
                ? "text-red-600"
                : index === 6
                  ? "text-blue-600"
                  : "text-gray-500"
            )}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {monthDates.map((date) => {
          const selected = date === selectedDate;
          const isToday = date === today;
          const inMonth = sameMonthISO(date, selectedDate);
          const count = scheduleCounts[date] ?? 0;
          const dayNum = Number(date.slice(8, 10));
          const weekday = weekdayIndex(date);

          return (
            <button
              key={date}
              type="button"
              onClick={() => setPeekDate(date)}
              aria-label={`${date}${count > 0 ? ` 予定${count}件` : ""}`}
              className={cn(
                "tap-press flex h-12 flex-col items-center justify-center rounded-xl border-2 px-0.5 py-0.5 text-center transition-all",
                selected
                  ? "border-navy-900 bg-navy-900"
                  : inMonth
                    ? "border-gray-100 bg-gray-50 hover:border-navy-300"
                    : "border-transparent bg-transparent",
                isToday && !selected && "border-navy-400"
              )}
            >
              <span
                className={cn(
                  "text-lg font-bold leading-none",
                  weekdayColor(weekday, selected),
                  !inMonth && !selected && "opacity-60"
                )}
              >
                {dayNum}
              </span>
              {count > 0 ? (
                <span
                  className={cn(
                    "mt-0.5 rounded-full px-1.5 text-sm font-bold leading-tight",
                    selected ? "bg-white/20 text-white" : "bg-navy-900 text-white"
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {peekDate ? (
        <DaySitesPanel
          key={peekDate}
          date={peekDate}
          onClose={() => setPeekDate(null)}
        />
      ) : null}
    </section>
  );
}
