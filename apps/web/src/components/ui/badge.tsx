import { cn } from "@/lib/cn";
import { siteStatusLabel, type SiteStatus } from "@/lib/site-rules";

// 色は飾りではなく意味：仮予定=オレンジ（点線）、進行中=作業中のオレンジ系、完了=緑。
// 色の見え方に個人差があるので、必ず文字でも伝える。
const statusStyles: Record<SiteStatus, string> = {
  draft: "bg-orange-50 text-orange-800 border-dashed border-orange-400",
  active: "bg-amber-50 text-amber-900 border-amber-300",
  on_hold: "bg-gray-50 text-gray-800 border-gray-300",
  completed: "bg-emerald-50 text-emerald-900 border-emerald-300",
  cancelled: "bg-gray-50 text-gray-600 border-dashed border-gray-300",
};

export function StatusBadge({ status }: { status: SiteStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full border-2 px-4 py-1 text-base font-bold",
        statusStyles[status] ?? statusStyles.active,
      )}
    >
      {siteStatusLabel(status)}
    </span>
  );
}

/** 1日で終わる工事（単発）の現場に付ける目印 */
export function OneOffBadge() {
  return (
    <span className="inline-flex shrink-0 rounded-full border-2 border-navy-700 bg-navy-900/5 px-4 py-1 text-base font-bold text-navy-900">
      単発
    </span>
  );
}
