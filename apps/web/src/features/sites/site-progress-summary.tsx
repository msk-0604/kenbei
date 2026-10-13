import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { ProgressSummary } from "@/lib/site-rules";

export function SiteProgressSummary({
  summaries,
}: {
  summaries: (ProgressSummary & {
    project_id: string;
    project_name: string;
  })[];
}) {
  if (summaries.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-lg font-bold text-gray-800">
        現場ごとの工事進捗
      </h2>
      <ul className="space-y-3">
        {summaries.map((s) => (
          <li key={s.project_id}>
            <Link href={`/sites/${s.project_id}/progress`}>
              <Card className="!p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-lg font-bold text-navy-950">
                    {s.project_name}
                  </p>
                  <p className="text-2xl font-bold text-navy-900">
                    {s.percent}%
                  </p>
                </div>
                <p className="mt-1 text-base text-amber-700">
                  未完了 {s.pending}件
                </p>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-navy-900"
                    style={{ width: `${s.percent}%` }}
                  />
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
