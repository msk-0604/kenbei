import { scoreAgainstSeed, type SimilarProjectCandidate, type SimilarityReason } from "./score";
import type { ProjectFeatures, SimilarProjectQuery } from "./types";

export type { ProjectFeatures, SimilarProjectQuery } from "./types";
export type { SimilarProjectCandidate, SimilarityReason } from "./score";
export { durationBand, durationFromPlan, scoreAgainstSeed } from "./score";

export type SimilarProjectMatch = {
  projectId: string;
  name: string;
  score: number;
  evidence: Record<string, number>;
  reasons: SimilarityReason[];
  delayedCount: number;
  durationDays?: number;
  taskTitles: string[];
  processNames: string[];
  incidents: string[];
  lessons: string[];
};

export type SimilarProjectResult = {
  matches: SimilarProjectMatch[];
  stats: {
    count: number;
    avgDurationDays?: number;
    avgLaborDays?: number;
    avgGrossProfitRate?: number;
    flagRates: Record<string, { hit: number; total: number }>;
  };
};

export interface SimilarProjectEngine {
  findSimilar(query: SimilarProjectQuery): Promise<SimilarProjectResult>;
}

export class RuleBasedSimilarProjectEngine implements SimilarProjectEngine {
  async findSimilar(query: SimilarProjectQuery): Promise<SimilarProjectResult> {
    const orgId = query.organizationId;
    const pool = (query.candidates ?? []).filter(
      (item) => item.organizationId === orgId && item.projectId !== query.excludeProjectId,
    );
    const scored = pool
      .map((item) => {
        const result = scoreAgainstSeed(query.seed, item);
        return { item, ...result };
      })
      .filter((row) => row.score >= 0.15 && row.reasons.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, query.limit ?? 5);

    const durations = scored
      .map((row) => row.item.durationDays)
      .filter((value): value is number => typeof value === "number");
    const delayed = scored.filter((row) => row.item.delayedCount > 0).length;

    return {
      matches: scored.map((row) => ({
        projectId: row.item.projectId,
        name: row.item.name,
        score: row.score,
        evidence: row.evidence,
        reasons: row.reasons,
        delayedCount: row.item.delayedCount,
        durationDays: row.item.durationDays,
        taskTitles: row.item.taskTitles.slice(0, 8),
        processNames: row.item.processNames.slice(0, 8),
        incidents: row.item.incidents.slice(0, 5),
        lessons: row.item.lessons.slice(0, 5),
      })),
      stats: {
        count: scored.length,
        avgDurationDays:
          durations.length > 0
            ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
            : undefined,
        flagRates: {
          delayed: { hit: delayed, total: scored.length },
        },
      },
    };
  }
}
