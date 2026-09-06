export type ProjectFeatures = {
  workTypes: string[];
  buildingType?: string;
  scaleBand?: string;
  amountBand?: string;
  buildingAgeBand?: string;
  workSummary?: string;
  region?: { prefecture?: string; city?: string };
  durationDays?: number;
  extra?: Record<string, unknown>;
};

export type SimilarProjectQuery = {
  organizationId: string;
  seed: Partial<ProjectFeatures> & { processNames?: string[] };
  excludeProjectId?: string;
  candidates?: import("./score").SimilarProjectCandidate[];
  limit?: number;
};
