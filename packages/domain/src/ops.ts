export const PROJECT_STATUS_LABELS = {
  draft: "準備中",
  active: "施工中",
  on_hold: "一時停止",
  completed: "完了",
  cancelled: "中止",
} as const;

export const TASK_STATUS_LABELS = {
  todo: "未着手",
  in_progress: "進行中",
  review: "確認待ち",
  done: "完了",
} as const;

export const PROCESS_STATUS_LABELS = {
  not_started: "未着手",
  in_progress: "進行中",
  delayed: "遅延",
  completed: "完了",
} as const;

export const DOCUMENT_KIND_LABELS = {
  safety: "安全マニュアル",
  rule: "社内ルール",
  technical: "技術資料",
  case: "過去事例",
  other: "その他",
} as const;

export const DRAWING_KIND_LABELS = {
  plan: "平面図",
  elevation: "立面図",
  section: "断面図",
  detail: "詳細図",
  other: "その他",
} as const;

export const DRAWING_KINDS = ["plan", "elevation", "section", "detail", "other"] as const;

export type DrawingKind = (typeof DRAWING_KINDS)[number];

export function isDrawingKind(value: string): value is DrawingKind {
  return (DRAWING_KINDS as readonly string[]).includes(value);
}

export const PRIORITY_LABELS = {
  low: "低",
  normal: "中",
  high: "高",
} as const;

export function projectProgressPercent(percents: readonly number[]): number {
  if (percents.length === 0) {
    return 0;
  }
  const sum = percents.reduce((total, value) => total + value, 0);
  return Math.round(sum / percents.length);
}

export function isProcessDelayed(input: {
  status: string;
  percent: number;
  plannedEndOn: string | null;
  todayIso: string;
}): boolean {
  if (input.status === "completed" || input.percent >= 100) {
    return false;
  }
  if (input.status === "delayed") {
    return true;
  }
  return Boolean(input.plannedEndOn && input.plannedEndOn < input.todayIso);
}

export function isTaskOverdue(input: {
  status: string;
  dueOn: string | null;
  todayIso: string;
}): boolean {
  if (input.status === "done" || !input.dueOn) {
    return false;
  }
  return input.dueOn < input.todayIso;
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function isAllowedImageType(value: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value);
}

export const MAX_PHOTO_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_PHOTOS_PER_BATCH = 20;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type ParsedSiteSearch = {
  text: string;
  from?: string;
  to?: string;
  floor?: string;
};

export function addDaysIso(isoDate: string, days: number): string {
  const parts = isoDate.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const utc = Date.UTC(year, month - 1, day);
  const next = new Date(utc + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

/** Parses phrases like 「3日前」「2階」 so photo search can grow into natural language later. */
export function parseSiteSearchQuery(raw: string, todayIso: string): ParsedSiteSearch {
  let text = raw.replace(/\s+/g, " ").trim();
  let from: string | undefined;
  let to: string | undefined;
  let floor: string | undefined;

  const ago = /(?:^|\s)(\d+)\s*日前(?:\s|$)/.exec(` ${text} `);
  const agoDays = ago?.[1];
  if (agoDays) {
    const date = addDaysIso(todayIso, -Number(agoDays));
    from = date;
    to = date;
    text = text.replace(new RegExp(`${agoDays}\\s*日前`), " ").replace(/\s+/g, " ").trim();
  }

  const iso = /(?:^|\s)(\d{4}-\d{2}-\d{2})(?:\s|$)/.exec(` ${text} `);
  const isoDate = iso?.[1];
  if (isoDate && !from) {
    from = isoDate;
    to = isoDate;
    text = text.replace(isoDate, " ").replace(/\s+/g, " ").trim();
  }

  const floorMatch = /(?:^|\s)(\d+)\s*階(?:\s|$)/.exec(` ${text} `);
  const floorNumber = floorMatch?.[1];
  if (floorNumber) {
    floor = `${floorNumber}階`;
    text = text.replace(new RegExp(`${floorNumber}\\s*階`), " ").replace(/\s+/g, " ").trim();
  }

  return { text, from, to, floor };
}

/** Rough office-time model used on Today. Conservative on purpose. */
export function estimateOfficeMinutes(input: {
  photoCount: number;
  hasReportDraft: boolean;
  hasReportConfirmed: boolean;
  openTaskCount: number;
}): { beforeMinutes: number; afterMinutes: number; savedMinutes: number } {
  const photoBefore = Math.min(60, input.photoCount * 3);
  const photoAfter = Math.min(12, Math.max(2, Math.ceil(input.photoCount * 0.4)));
  const reportBefore = input.hasReportDraft || input.hasReportConfirmed || input.photoCount > 0 ? 45 : 0;
  const reportAfter = input.hasReportConfirmed ? 3 : input.hasReportDraft ? 8 : input.photoCount > 0 ? 12 : 0;
  const taskBefore = Math.min(20, input.openTaskCount * 4);
  const taskAfter = Math.min(8, input.openTaskCount * 1);
  const beforeMinutes = photoBefore + reportBefore + taskBefore;
  const afterMinutes = photoAfter + reportAfter + taskAfter;
  return {
    beforeMinutes,
    afterMinutes,
    savedMinutes: Math.max(0, beforeMinutes - afterMinutes),
  };
}
