import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getMonthAttendance } from "@/features/attendance/queries";
import { formatMinutes, normalizeMonth } from "@/features/attendance/summary";
import { requireSiteAdmin } from "@/lib/authz-guard";
import { addMonthsISO, formatClockTime, formatYearMonth, todayISO } from "@/lib/site-dates";

export const dynamic = "force-dynamic";

/** 出面表：作業員が押した「作業開始・終了」を月ごとにまとめる。給料計算や元請けへの請求に使う。 */
export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireSiteAdmin();
  const params = await searchParams;
  const today = todayISO();
  const month = normalizeMonth(params.month, today);
  const workers = await getMonthAttendance(month).catch(() => []);
  const prev = addMonthsISO(`${month}-01`, -1).slice(0, 7);
  const next = addMonthsISO(`${month}-01`, 1).slice(0, 7);
  const totalDays = workers.reduce((sum, worker) => sum + worker.days, 0);
  const openCount = workers.reduce((sum, worker) => sum + worker.openCount, 0);
  const nav = "tap-press flex min-h-[3.5rem] shrink-0 items-center whitespace-nowrap rounded-xl border-2 border-gray-200 px-3 text-lg font-bold text-navy-900";

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/kanri"
          className="tap-press mb-5 flex min-h-[4rem] w-full items-center justify-center rounded-2xl border-2 border-gray-300 bg-white px-5 text-xl font-bold text-navy-900"
        >
          ← 管理画面に戻る
        </Link>
        <h1 className="text-3xl font-bold text-gray-950">出面表</h1>
        <p className="mt-2 text-lg leading-relaxed text-gray-700">
          作業員が押した「作業開始・終了」から、誰が・どの現場に・何日出たかをまとめます。給料の計算や元請けへの請求に使えます。
        </p>
      </header>

      <div className="flex items-center justify-between gap-2">
        <Link href={`/kanri/attendance?month=${prev}`} className={nav}>
          ‹ 前月
        </Link>
        <p className="whitespace-nowrap text-xl font-bold text-navy-950">{formatYearMonth(`${month}-01`)}</p>
        <Link href={`/kanri/attendance?month=${next}`} className={nav}>
          翌月 ›
        </Link>
      </div>

      {workers.length === 0 ? (
        <EmptyState
          title="この月の記録はまだありません"
          description="作業員が今日の画面で「作業を開始する」を押すと、ここに出ます。"
        />
      ) : (
        <>
          <Card>
            <p className="text-lg text-gray-800">
              作業員 <span className="text-2xl font-bold text-gray-950">{workers.length}</span> 人・のべ{" "}
              <span className="text-2xl font-bold text-gray-950">{totalDays}</span> 人工
            </p>
            {openCount > 0 ? (
              <p className="mt-2 text-base text-amber-800">
                「作業を終了する」が押されていない日が {openCount} 件あります。その日は時間に入れていません（日数には入れています）。
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <a
                href={`/kanri/attendance/csv?month=${month}`}
                className="tap-press flex min-h-14 items-center justify-center rounded-xl bg-navy-900 px-4 text-lg font-bold text-white"
              >
                Excel で保存（CSV）
              </a>
              <Link
                href={`/kanri/attendance/print?month=${month}`}
                className="tap-press flex min-h-14 items-center justify-center rounded-xl border-2 border-gray-300 bg-white px-4 text-lg font-bold text-navy-900"
              >
                印刷・PDF にする
              </Link>
            </div>
          </Card>

          <ul className="space-y-4">
            {workers.map((worker) => (
              <li key={worker.workerId}>
                <Card>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h2 className="text-2xl font-bold text-gray-950">{worker.workerName}</h2>
                    <p className="text-lg font-bold text-gray-900">
                      {worker.days}日・{formatMinutes(worker.minutes)}
                    </p>
                  </div>
                  <ul className="mt-3 space-y-1 text-base text-gray-800">
                    {worker.sites.map((site) => (
                      <li key={site.siteId} className="flex justify-between gap-3">
                        <span className="min-w-0 break-words">{site.siteName}</span>
                        <span className="shrink-0 whitespace-nowrap">
                          {site.days}日・{formatMinutes(site.minutes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-base font-bold text-gray-600">日ごとの記録を見る</summary>
                    <ul className="mt-2 divide-y divide-gray-100 text-base">
                      {worker.rows.map((row, index) => (
                        <li key={`${row.date}-${row.siteId}-${index}`} className="flex flex-wrap justify-between gap-x-3 py-2">
                          <span className="text-gray-700">
                            {Number(row.date.slice(5, 7))}/{Number(row.date.slice(8, 10))} {row.siteName}
                          </span>
                          <span className="whitespace-nowrap text-gray-900">
                            {formatClockTime(row.startedAt)}〜{row.endedAt ? formatClockTime(row.endedAt) : "（終了なし）"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </Card>
              </li>
            ))}
          </ul>
          <p className="text-sm text-gray-500">時間は「開始」から「終了」までで、休憩を含みます。</p>
        </>
      )}
    </div>
  );
}
