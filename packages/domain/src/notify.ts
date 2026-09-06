export const NOTIFICATION_KINDS = [
  "confirm_request",
  "task_assignment",
  "task_deadline",
  "report_confirm",
  "invite",
  "project_update",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export function canDeliverPushToken(input: {
  tokenOrganizationId: string;
  tokenProfileId: string;
  tokenActive: boolean;
  targetOrganizationId: string;
  targetProfileId: string;
}): boolean {
  return (
    input.tokenActive &&
    input.tokenOrganizationId.length > 0 &&
    input.tokenProfileId.length > 0 &&
    input.tokenOrganizationId === input.targetOrganizationId &&
    input.tokenProfileId === input.targetProfileId
  );
}

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

export type KenbeiRoute =
  | { type: "confirm" }
  | { type: "project"; projectId: string }
  | { type: "task"; taskId: string; projectId?: string }
  | { type: "report"; reportId: string; projectId?: string }
  | { type: "drawing"; drawingId: string; projectId?: string };

function firstGroup(source: string, pattern: RegExp): string | undefined {
  return source.match(pattern)?.[1];
}

export function parseKenbeiRoute(
  href: string | null | undefined,
  extra?: Record<string, string | undefined>,
): KenbeiRoute | null {
  const projectFromExtra = extra?.projectId;
  const taskFromExtra = extra?.taskId;
  const reportFromExtra = extra?.reportId;
  const drawingFromExtra = extra?.drawingId;
  if (taskFromExtra) {
    return { type: "task", taskId: taskFromExtra, projectId: projectFromExtra };
  }
  if (reportFromExtra) {
    return { type: "report", reportId: reportFromExtra, projectId: projectFromExtra };
  }
  if (drawingFromExtra) {
    return { type: "drawing", drawingId: drawingFromExtra, projectId: projectFromExtra };
  }
  if (!href) {
    if (extra?.kind === "confirm_request") {
      return { type: "confirm" };
    }
    if (projectFromExtra) {
      return { type: "project", projectId: projectFromExtra };
    }
    return null;
  }
  const path = (href
    .replace(/^kenbei:\/\//, "/")
    .replace(/^https?:\/\/[^/]+/i, "")
    .split("?")[0] ?? "").replace(/\/+$/, "");
  if (path === "/confirm" || path === "confirm") {
    return { type: "confirm" };
  }
  const nestedTask = path.match(new RegExp(`(?:^|/)projects/(${UUID})/tasks/(${UUID})$`));
  if (nestedTask?.[1] && nestedTask[2]) {
    return { type: "task", projectId: nestedTask[1], taskId: nestedTask[2] };
  }
  const task = firstGroup(path, new RegExp(`(?:^|/)tasks/(${UUID})$`));
  if (task) {
    return { type: "task", taskId: task, projectId: projectFromExtra };
  }
  const report = firstGroup(path, new RegExp(`(?:^|/)reports/(${UUID})$`));
  if (report) {
    return { type: "report", reportId: report, projectId: projectFromExtra };
  }
  const drawing = firstGroup(path, new RegExp(`(?:^|/)drawings/(${UUID})$`));
  if (drawing) {
    return { type: "drawing", drawingId: drawing, projectId: projectFromExtra };
  }
  const project = firstGroup(path, new RegExp(`(?:^|/)projects/(${UUID})$`));
  if (project) {
    return { type: "project", projectId: project };
  }
  return null;
}

export type DrawingVersionPlan = {
  version: number;
  seriesId: string | null;
  supersedesId: string | null;
  markPreviousLatestFalse: boolean;
};

export function nextDrawingVersion(latest: { id: string; version: number; seriesId: string } | null): DrawingVersionPlan {
  if (!latest) {
    return { version: 1, seriesId: null, supersedesId: null, markPreviousLatestFalse: false };
  }
  return {
    version: latest.version + 1,
    seriesId: latest.seriesId,
    supersedesId: latest.id,
    markPreviousLatestFalse: true,
  };
}
