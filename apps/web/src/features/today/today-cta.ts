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

export type TodayStepKey = "photo" | "task" | "report";

export type TodayStep = {
  key: TodayStepKey;
  title: string;
  status: string;
  done: boolean;
};

/**
 * The three things a site manager does every day, in order.
 * The first unfinished one becomes the big button on Today.
 */
export function todaySteps(input: {
  photoCount: number;
  openFocusTaskCount: number;
  reportStatus: "none" | "draft" | "confirmed";
}): { steps: TodayStep[]; next: TodayStepKey | null } {
  const steps: TodayStep[] = [
    {
      key: "photo",
      title: "写真を撮る",
      status: input.photoCount > 0 ? `今日 ${input.photoCount}枚` : "まだ0枚",
      done: input.photoCount > 0,
    },
    {
      key: "task",
      title: "作業をチェック",
      status: input.openFocusTaskCount > 0 ? `残り ${input.openFocusTaskCount}件` : "今日の残りなし",
      done: input.openFocusTaskCount === 0,
    },
    {
      key: "report",
      title: "日報を出す",
      status:
        input.reportStatus === "confirmed" ? "確定済み" : input.reportStatus === "draft" ? "下書きあり・確認待ち" : "まだ",
      done: input.reportStatus === "confirmed",
    },
  ];
  return { steps, next: steps.find((step) => !step.done)?.key ?? null };
}
