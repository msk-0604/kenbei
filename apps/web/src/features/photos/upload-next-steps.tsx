"use client";

import Link from "next/link";
import { CreateTodayReportButton } from "@/features/reports/forms";

export function PhotoUploadNextSteps({
  projectId,
  canReport,
}: {
  projectId: string;
  canReport: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
      <p className="font-medium text-emerald-950">写真を保存しました。次はどれにしますか。</p>
      <Link
        href={`/projects/${projectId}?tab=photos`}
        className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-4 font-medium text-zinc-900 ring-1 ring-zinc-200"
      >
        写真一覧を見る
      </Link>
      {canReport ? <CreateTodayReportButton projectId={projectId} /> : null}
      <Link
        href={`/projects/${projectId}?tab=tasks`}
        className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-4 font-medium text-zinc-900 ring-1 ring-zinc-200"
      >
        タスクを追加
      </Link>
    </div>
  );
}
