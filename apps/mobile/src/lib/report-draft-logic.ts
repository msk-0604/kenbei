export type ReportDraftFields = {
  body: string;
  weather: string;
  workLocation: string;
  workerCount: string;
  progressNote: string;
  issues: string;
  safetyNotes: string;
  tomorrowPlan: string;
  remarks: string;
  photoIds: string[];
};

export type LocalReportDraft = ReportDraftFields & {
  organizationId: string;
  projectId: string;
  projectName: string;
  workOn: string;
  reportId: string | null;
  updatedAt: number;
  syncedAt: number | null;
};

export function reportDraftKey(organizationId: string, projectId: string, workOn: string): string {
  return `${organizationId}:${projectId}:${workOn}`;
}

export function emptyReportFields(): ReportDraftFields {
  return {
    body: "",
    weather: "",
    workLocation: "",
    workerCount: "",
    progressNote: "",
    issues: "",
    safetyNotes: "",
    tomorrowPlan: "",
    remarks: "",
    photoIds: [],
  };
}

export function preferReportDraft<T extends { updatedAt: number; body: string; photoIds: string[] }>(
  local: T | null,
  server: T | null,
): T {
  if (local && server) {
    return local.updatedAt >= server.updatedAt ? local : server;
  }
  if (local) {
    return local;
  }
  if (server) {
    return server;
  }
  throw new Error("no draft");
}

export function togglePhotoId(ids: string[], photoId: string): string[] {
  if (ids.includes(photoId)) {
    return ids.filter((id) => id !== photoId);
  }
  return [...ids, photoId].slice(0, 12);
}
