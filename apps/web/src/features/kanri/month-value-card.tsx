import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { KENBEI_MONTHLY_PRICE_JPY } from "@kensapo/domain";
import {
  HOURLY_COST_YEN,
  MINUTES_SAVED_PER_REPORT,
  MINUTES_SAVED_PER_WORKDAY,
  estimateMonthValue,
  formatSavedTime,
  type MonthActivity,
} from "@/features/kanri/month-value";

/** 管理画面の「今月の KENBEI」。今月やったことと浮いた時間の目安、出面表への入口。 */
export function MonthValueCard({ activity, month }: { activity: MonthActivity; month: number }) {
  const value = estimateMonthValue(activity);
  const items = [
    { label: "日報", value: value.reports, unit: "枚" },
    { label: "写真", value: value.photos, unit: "枚" },
    { label: "出面", value: value.workdays, unit: "人工" },
  ];
  return (
    <section aria-label={`${month}月の KENBEI`} className="rounded-xl border border-gray-300 bg-white p-4">
      <h2 className="text-base font-bold text-gray-950">{month}月の KENBEI</h2>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg bg-gray-50 py-2">
            <dt className="text-xs text-gray-600">{item.label}</dt>
            <dd>
              <span className="text-2xl font-bold tabular-nums text-gray-950">{item.value}</span>
              <span className="ml-0.5 text-xs text-gray-600">{item.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
      {value.minutesSaved > 0 ? (
        <p className="mt-3 text-base text-gray-900">
          浮いた時間の目安：
          <span className="font-bold">{formatSavedTime(value.minutesSaved)}</span>
          {value.yenSaved > 0 ? (
            <>
              （約<span className="font-bold">{value.yenSaved.toLocaleString("ja-JP")}</span>円分。月額
              {KENBEI_MONTHLY_PRICE_JPY.toLocaleString("ja-JP")}円）
            </>
          ) : null}
        </p>
      ) : (
        <p className="mt-3 text-base text-gray-700">日報を作ったり、作業員が作業開始を押したりすると、浮いた時間の目安がここに出ます。</p>
      )}
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        目安の前提：日報1枚で{MINUTES_SAVED_PER_REPORT}分、出面1人工で{MINUTES_SAVED_PER_WORKDAY}分の短縮、時給
        {HOURLY_COST_YEN.toLocaleString("ja-JP")}円として計算しています。
      </p>
      <Link
        href="/kanri/attendance"
        className="tap-press mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gray-300 px-3 text-base font-bold text-gray-950"
      >
        <ClipboardList className="h-5 w-5 shrink-0 text-gray-700" aria-hidden />
        出面表を見る（Excel・印刷）
      </Link>
    </section>
  );
}
