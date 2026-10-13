import { Card } from "@/components/ui/card";

export function ScheduleDetailsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-14 flex-1 animate-pulse rounded-xl bg-gray-200"
            />
          ))}
        </div>
        <div className="mb-4 h-12 animate-pulse rounded-xl bg-gray-200" />
        <div className="mb-1 grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={index}
              className="mx-auto h-4 w-6 animate-pulse rounded bg-gray-200"
            />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, index) => (
            <div
              key={index}
              className="h-12 animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
      </div>
      <Card className="!p-5">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-20 animate-pulse rounded-xl bg-gray-100" />
      </Card>
    </div>
  );
}
