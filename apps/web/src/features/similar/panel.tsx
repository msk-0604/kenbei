import Link from "next/link";
import type { SimilarProjectResult } from "@kensapo/similar-projects";

export function SimilarProjectsPanel({ result }: { result: SimilarProjectResult | null }) {
  if (!result || result.matches.length === 0) {
    return (
      <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
        <h2 className="text-base font-medium">似た現場</h2>
        <p className="mt-2 text-sm text-zinc-500">比較できる過去現場はまだありません。工事種別・工期・工程を入れると候補が出ます。</p>
      </section>
    );
  }
  const delayedRate = result.stats.flagRates.delayed;
  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
      <h2 className="text-base font-medium">似た現場</h2>
      <p className="mt-2 text-sm text-zinc-500">
        ルールで比較しています（工事種別・規模・工期・工程構成）。
        {result.stats.avgDurationDays ? ` 平均工期 ${result.stats.avgDurationDays}日。` : ""}
        {delayedRate && delayedRate.total > 0
          ? ` 候補のうち遅延あり ${delayedRate.hit}/${delayedRate.total}。`
          : ""}
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {result.matches.map((item) => (
          <li key={item.projectId} className="rounded-2xl bg-zinc-50 px-4 py-3">
            <Link href={`/projects/${item.projectId}`} className="font-medium underline">
              {item.name}
            </Link>
            <p className="mt-1 text-xs text-zinc-500">類似度 {Math.round(item.score * 100)}%</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-zinc-700">
              {item.reasons.map((reason) => (
                <li key={reason.code}>{reason.label}</li>
              ))}
            </ul>
            {item.taskTitles[0] ? <p className="mt-2 text-sm">参考Task: {item.taskTitles.slice(0, 3).join("、")}</p> : null}
            {item.processNames[0] ? <p className="text-sm">参考工程: {item.processNames.slice(0, 4).join("、")}</p> : null}
            {item.incidents[0] ? <p className="text-sm text-red-800">incidents: {item.incidents[0]}</p> : null}
            {item.lessons[0] ? <p className="text-sm">lessons: {item.lessons.slice(0, 2).join("、")}</p> : null}
            {item.delayedCount > 0 ? <p className="text-sm text-red-700">遅延工程 {item.delayedCount}件</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
