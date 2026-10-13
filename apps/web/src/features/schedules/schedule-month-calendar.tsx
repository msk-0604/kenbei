"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { addMonthsISO, formatYearMonth, sameMonthISO, todayISO } from "@/lib/site-dates";
import { DaySitesPanel } from "@/features/schedules/day-sites-panel";

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"] as const;

export function ScheduleMonthCalendar({
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

  function goMonth(offset: number) {
    router.push(`/schedule?date=${addMonthsISO(selectedDate, offset)}`, {
      scroll: false,
    });
  }

  return (
    <section className="mb-8 rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goMonth(-1)}
          className="tap-press min-h-[3.5rem] rounded-xl border-2 border-gray-200 px-3 text-lg font-bold text-navy-900"
        >
          前の月
        </button>
        <p className="text-center text-xl font-bold text-navy-950">
          {formatYearMonth(selectedDate)}
        </p>
        <button
          type="button"
          onClick={() => goMonth(1)}
          className="tap-press min-h-[3.5rem] rounded-xl border-2 border-gray-200 px-3 text-lg font-bold text-navy-900"
        >
          次の月
        </button>
      </div>

      <button
        type="button"
        onClick={() => router.push(`/schedule?date=${today}`, { scroll: false })}
        className="tap-press mb-4 min-h-[3rem] w-full rounded-xl bg-navy-900 px-4 text-lg font-bold text-white"
      >
        今日の日付に戻る
      </button>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-base font-bold text-gray-500"
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

          return (
            <button
              key={date}
              type="button"
              onClick={() => setPeekDate(date)}
              aria-label={`${date}${count > 0 ? ` 予定${count}件` : ""}`}
              className={cn(
                "tap-press flex h-12 flex-col items-center justify-center rounded-xl border-2 px-0.5 py-0.5 text-center transition-colors",
                selected
                  ? "border-navy-900 bg-navy-900 text-white"
                  : inMonth
                    ? "border-gray-100 bg-gray-50 text-navy-950 hover:border-navy-300"
                    : "border-transparent bg-transparent text-gray-400",
                isToday && !selected && "border-navy-400"
              )}
            >
              <span
                className={cn(
                  "text-lg font-bold leading-none",
                  !inMonth && !selected && "opacity-60"
                )}
              >
                {dayNum}
              </span>
              {count > 0 ? (
                <span
                  className={cn(
                    "mt-0.5 rounded-full px-1.5 text-sm font-bold leading-tight",
                    selected ? "bg-white/20" : "bg-navy-900 text-white"
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
