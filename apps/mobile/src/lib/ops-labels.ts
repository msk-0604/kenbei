export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "未着手",
  in_progress: "進行中",
  review: "確認待ち",
  done: "完了",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "低",
  normal: "中",
  high: "高",
};

export const PROCESS_STATUS_LABELS: Record<string, string> = {
  not_started: "未着手",
  in_progress: "進行中",
  delayed: "遅延",
  completed: "完了",
};

export const REPORT_STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  confirmed: "確定",
};

export const WEATHER_OPTIONS = ["晴れ", "曇り", "雨", "雪"] as const;

export const TASK_STATUSES = ["todo", "in_progress", "review", "done"] as const;
export const PRIORITIES = ["low", "normal", "high"] as const;
