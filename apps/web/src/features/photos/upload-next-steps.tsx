"use client";

import Link from "next/link";
import { CreateTodayReportButton } from "@/features/reports/forms";
import { AppLink } from "@/components/app-nav";

export function PhotoUploadNextSteps({
  projectId,
  canReport,
  photoId,
}: {
  projectId: string;
  canReport: boolean;
  photoId?: string | null;
}) {
  const taskHref = photoId ? `/photos/${photoId}` : `/projects/${projectId}?tab=photos`;
  return (
    <div className="kb-enter mb-6 flex flex-col gap-3 rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
      <p className="font-medium text-emerald-950">✓ 写真を保存しました</p>
      <p className="text-sm text-emerald-900">次は作業の追加か、日報です。</p>
      <AppLink href={taskHref}>{photoId ? "この写真からタスクを追加" : "写真からタスクを追加"}</AppLink>
      {canReport ? <CreateTodayReportButton projectId={projectId} variant="secondary" /> : null}
      <Link
        href={`/projects/${projectId}?tab=photos`}
        className="kb-tap inline-flex min-h-12 items-center justify-center rounded-2xl px-4 text-sm font-medium text-zinc-600"
      >
        写真一覧を見る
      </Link>
    </div>
  );
}
