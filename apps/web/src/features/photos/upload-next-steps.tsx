"use client";

import { AppLink } from "@/components/app-nav";
import { TODAY_TASK_LABEL } from "@/features/today/today-cta";

export function PhotoUploadNextSteps({
  projectId,
  canReport,
  photoId,
}: {
  projectId: string;
  canReport: boolean;
  photoId?: string | null;
}) {
  const taskHref = photoId ? `/photos/${photoId}` : `/#today-add-task`;
  return (
    <div className="kb-enter flex flex-col gap-2">
      <p className="font-medium">✓ 写真を保存しました</p>
      <AppLink href="/">今日へ戻る</AppLink>
      <AppLink href={taskHref} variant="secondary">
        {TODAY_TASK_LABEL}
      </AppLink>
      {canReport ? (
        <AppLink href={`/projects/${projectId}?tab=reports`} variant="ghost">
          日報へ
        </AppLink>
      ) : null}
    </div>
  );
}
