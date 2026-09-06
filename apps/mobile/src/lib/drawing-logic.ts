export function drawingStoragePath(
  organizationId: string,
  projectId: string,
  seriesId: string,
  drawingId: string,
): string {
  return `${organizationId}/projects/${projectId}/drawings/${seriesId}/${drawingId}.pdf`;
}

export function nextDrawingVersion(latest: { id: string; version: number; seriesId: string } | null): {
  version: number;
  seriesId: string | null;
  supersedesId: string | null;
  markPreviousLatestFalse: boolean;
} {
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

export const DRAWING_KIND_LABELS: Record<string, string> = {
  plan: "平面図",
  elevation: "立面図",
  section: "断面図",
  detail: "詳細図",
  other: "その他",
};

export const MAX_DRAWING_BYTES = 10 * 1024 * 1024;
