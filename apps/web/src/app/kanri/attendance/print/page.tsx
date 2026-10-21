import Link from "next/link";
import { getMonthAttendance } from "@/features/attendance/queries";
import { formatMinutes, monthBounds, normalizeMonth } from "@/features/attendance/summary";
import { PrintButton } from "@/features/reports/print-button";
import { requireSiteAdmin } from "@/lib/authz-guard";
import { formatYearMonth, todayISO } from "@/lib/site-dates";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** 紙の出面表と同じ形（縦に作業員、横に日付、出た日に○）。A4 横で印刷・PDF にする。 */
export default async function AttendancePrintPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const workspace = await requireSiteAdmin();
  const params = await searchParams;
  const month = normalizeMonth(params.month, todayISO());
  const workers = await getMonthAttendance(month).catch(() => []);
  const { to } = monthBounds(month);
  const days = Array.from({ length: Number(to.slice(8, 10)) }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    return { date, day: index + 1, weekday: new Date(`${date}T12:00:00+09:00`).getUTCDay() };
  });

  return (
    <div className="min-h-dvh bg-white px-6 py-6 text-gray-950 print:p-0">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print { .no-print { display: none !important; } }
      `}</style>
      <p className="no-print mb-4 flex flex-wrap items-center gap-4 text-sm">
        <Link href={`/kanri/attendance?month=${month}`} className="underline">
          出面表に戻る
        </Link>
        <PrintButton />
      </p>
      <header className="mb-3 flex items-end justify-between border-b-2 border-gray-900 pb-2">
        <div>
          <p className="text-sm">{workspace.organizationName}</p>
          <h1 className="text-2xl font-bold">出面表　{formatYearMonth(`${month}-01`)}</h1>
        </div>
        <p className="text-xs text-gray-600">○＝作業開始の記録がある日／時間は開始〜終了（休憩を含む）</p>
      </header>
      {workers.length === 0 ? (
        <p className="text-base">この月の記録はまだありません。</p>
      ) : (
        <table className="w-full table-fixed border-collapse text-[10px] leading-tight">
          <thead>
            <tr>
              <th className="w-28 border border-gray-400 px-1 py-1 text-left">作業員</th>
              {days.map((d) => (
                <th
                  key={d.date}
                  className={`border border-gray-400 py-0.5 text-center font-normal ${d.weekday === 0 ? "text-red-600" : d.weekday === 6 ? "text-blue-600" : ""}`}
                >
                  {d.day}
                  <br />
                  {WEEKDAYS[d.weekday]}
                </th>
              ))}
              <th className="w-10 border border-gray-400 text-center">日数</th>
              <th className="w-16 border border-gray-400 text-center">時間</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => {
              const worked = new Set(worker.rows.map((row) => row.date));
              return (
                <tr key={worker.workerId}>
                  <td className="border border-gray-400 px-1 py-1.5 font-bold">{worker.workerName}</td>
                  {days.map((d) => (
                    <td key={d.date} className="border border-gray-400 text-center">
                      {worked.has(d.date) ? "○" : ""}
                    </td>
                  ))}
                  <td className="border border-gray-400 text-center font-bold">{worker.days}</td>
                  <td className="border border-gray-400 text-center">{formatMinutes(worker.minutes)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {workers.length > 0 ? (
        <section className="mt-4 break-inside-avoid">
          <h2 className="mb-1 text-sm font-bold">現場ごとの内訳</h2>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="border border-gray-400 px-1 py-1 text-left">作業員</th>
                <th className="border border-gray-400 px-1 py-1 text-left">現場</th>
                <th className="w-12 border border-gray-400 px-1 py-1">日数</th>
                <th className="w-20 border border-gray-400 px-1 py-1">時間</th>
              </tr>
            </thead>
            <tbody>
              {workers.flatMap((worker) =>
                worker.sites.map((site) => (
                  <tr key={`${worker.workerId}-${site.siteId}`}>
                    <td className="border border-gray-400 px-1 py-0.5">{worker.workerName}</td>
                    <td className="border border-gray-400 px-1 py-0.5">{site.siteName}</td>
                    <td className="border border-gray-400 px-1 py-0.5 text-center">{site.days}</td>
                    <td className="border border-gray-400 px-1 py-0.5 text-center">{formatMinutes(site.minutes)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
