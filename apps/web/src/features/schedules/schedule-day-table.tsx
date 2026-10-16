import { scheduleStatusLabel } from "@/lib/site-rules";
import { formatTime } from "@/lib/site-dates";
import type { ScheduleWithDetails } from "@/features/sites/types";

function timeToHour(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  return Number(match[1]) + Number(match[2]) / 60;
}

function isAm(schedule: ScheduleWithDetails): boolean {
  const hour = timeToHour(schedule.scheduled_start_time);
  if (hour !== null) return hour < 12;
  if (schedule.time_kind === "pm") return false;
  return true;
}

function sortKey(schedule: ScheduleWithDetails): number {
  const hour = timeToHour(schedule.scheduled_start_time);
  return hour ?? 99;
}

function TableSection({
  label,
  rows,
}: {
  label: string;
  rows: ScheduleWithDetails[];
}) {
  if (rows.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="mb-2 text-lg font-bold text-navy-950">{label}</p>
      <div className="overflow-x-auto rounded-xl border-2 border-gray-200">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="border border-gray-200 px-2 py-2 text-left font-bold">
                会社
              </th>
              <th className="border border-gray-200 px-2 py-2 text-left font-bold">
                場所
              </th>
              <th className="border border-gray-200 px-2 py-2 text-left font-bold">
                現場名
              </th>
              <th className="border border-gray-200 px-2 py-2 text-left font-bold">
                作業内容
              </th>
              <th className="border border-gray-200 px-2 py-2 text-left font-bold">
                人員
              </th>
              <th className="border border-gray-200 px-2 py-2 text-left font-bold">
                時間
              </th>
              <th className="border border-gray-200 px-2 py-2 text-center font-bold">
                チェック
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const done = s.status === "completed";
              const timeLabel =
                s.scheduled_start_time || s.scheduled_end_time
                  ? `${formatTime(s.scheduled_start_time) || "—"}〜${formatTime(s.scheduled_end_time) || "—"}`
                  : "—";
              return (
                <tr key={s.id} className="align-top">
                  <td className="border border-gray-200 px-2 py-2">
                    {s.client_company_name || "—"}
                  </td>
                  <td className="border border-gray-200 px-2 py-2">
                    {s.location || "—"}
                  </td>
                  <td className="border border-gray-200 px-2 py-2 font-bold text-navy-950">
                    {s.project_name}
                  </td>
                  <td className="border border-gray-200 px-2 py-2">
                    {s.title || s.work_content || "—"}
                  </td>
                  <td className="border border-gray-200 px-2 py-2">
                    {s.worker_name || "未割当"}
                  </td>
                  <td className="border border-gray-200 px-2 py-2 whitespace-nowrap">
                    {timeLabel}
                  </td>
                  <td className="border border-gray-200 px-2 py-2 text-center">
                    {done ? (
                      <span className="text-lg font-bold text-green-700">✓</span>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {scheduleStatusLabel(s.status)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ScheduleDayTable({
  schedules,
}: {
  schedules: ScheduleWithDetails[];
}) {
  if (schedules.length === 0) return null;

  const sorted = [...schedules].sort((a, b) => sortKey(a) - sortKey(b));
  const am = sorted.filter((s) => isAm(s));
  const pm = sorted.filter((s) => !isAm(s));

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-lg font-bold text-gray-800">
        表形式で見る（行動予定／記録表）
      </h2>
      <TableSection label="AM" rows={am} />
      <TableSection label="PM" rows={pm} />
    </section>
  );
}
