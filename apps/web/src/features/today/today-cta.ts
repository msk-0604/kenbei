export const TODAY_PHOTO_LABEL = "写真を追加";
export const TODAY_TASK_LABEL = "今日の作業を追加";
export const TODAY_REPORT_LABEL = "今日の日報を作る";
export const TODAY_REPORT_REVIEW_LABEL = "今日の日報を確認";
export const TODAY_REPORT_DONE_LABEL = "今日の日報を見る";
export const TODAY_TASK_ANCHOR = "today-add-task";

export function todayPhotoHref(projectId: string | null | undefined): string {
  return projectId ? `/photos/upload?projectId=${projectId}` : "/photos/upload";
}

export function todayTaskHref(): string {
  return `#${TODAY_TASK_ANCHOR}`;
}

export function todayReportHref(reportId: string): string {
  return `/reports/${reportId}`;
}
