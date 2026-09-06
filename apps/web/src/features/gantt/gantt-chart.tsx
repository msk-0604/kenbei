import { PROCESS_STATUS_LABELS } from "@kensapo/domain";
import type { ProcessRecord } from "@/features/site-ops/queries";

export function GanttChart({ processes }: { processes: ProcessRecord[] }) {
  const dates = processes.flatMap((item) => [item.plannedStartOn, item.plannedEndOn]).filter(Boolean) as string[];
  if (processes.length === 0 || dates.length === 0) {
    return <p className="text-sm text-zinc-500">工程の開始・終了日を入れるとガントが表示されます。</p>;
  }
  const min = dates.reduce((a, b) => (a < b ? a : b));
  const max = dates.reduce((a, b) => (a > b ? a : b));
  const start = Date.parse(min);
  const end = Date.parse(max) + 86_400_000;
  const span = Math.max(end - start, 86_400_000);

  return (
    <section className="overflow-x-auto rounded-3xl bg-white p-4 ring-1 ring-zinc-100">
      <h2 className="mb-3 text-base font-medium">工程ガント（遅れは赤）</h2>
      <div className="min-w-[640px] space-y-2">
        {processes.map((item) => {
          const from = Date.parse(item.plannedStartOn ?? min);
          const to = Date.parse(item.plannedEndOn ?? item.plannedStartOn ?? min) + 86_400_000;
          const left = ((from - start) / span) * 100;
          const width = Math.max(((to - from) / span) * 100, 4);
          return (
            <div key={item.id} className="grid grid-cols-[8rem_1fr] items-center gap-3">
              <p className="truncate text-sm">{item.name}</p>
              <div className="relative h-8 rounded-lg bg-zinc-100">
                <div
                  className={`absolute top-1 h-6 rounded-md ${item.delayed ? "bg-red-500" : "bg-zinc-800"}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${PROCESS_STATUS_LABELS[item.status as keyof typeof PROCESS_STATUS_LABELS] ?? item.status} ${item.percent}%`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
