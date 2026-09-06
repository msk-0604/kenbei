import { calcDurationDays } from "@kensapo/domain";
import type { ProjectFeatures } from "./types";

export type SimilarityReason = {
  code: string;
  label: string;
  weight: number;
};

export type SimilarProjectCandidate = {
  organizationId: string;
  projectId: string;
  name: string;
  features: ProjectFeatures;
  processNames: string[];
  delayedCount: number;
  taskTitles: string[];
  incidents: string[];
  lessons: string[];
  durationDays?: number;
};

function tokens(text: string | undefined): Set<string> {
  if (!text) {
    return new Set();
  }
  return new Set(
    text
      .toLowerCase()
      .split(/[\s、。,/・|]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2),
  );
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  const left = new Set(a.map((item) => item.toLowerCase()).filter(Boolean));
  const right = new Set(b.map((item) => item.toLowerCase()).filter(Boolean));
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  let hit = 0;
  for (const item of left) {
    if (right.has(item)) {
      hit += 1;
    }
  }
  return hit / new Set([...left, ...right]).size;
}

export function durationBand(days: number | undefined): string | undefined {
  if (days == null || !Number.isFinite(days)) {
    return undefined;
  }
  if (days < 30) {
    return "short";
  }
  if (days < 90) {
    return "mid";
  }
  return "long";
}

export function durationFromPlan(startOn: string | null, endOn: string | null): number | undefined {
  if (!startOn || !endOn) {
    return undefined;
  }
  try {
    return calcDurationDays(startOn, endOn);
  } catch {
    return undefined;
  }
}

export function scoreAgainstSeed(
  seed: Partial<ProjectFeatures> & { processNames?: string[] },
  candidate: SimilarProjectCandidate,
): { score: number; evidence: Record<string, number>; reasons: SimilarityReason[] } {
  const reasons: SimilarityReason[] = [];
  const evidence: Record<string, number> = {};

  const work = jaccard(seed.workTypes ?? [], candidate.features.workTypes);
  evidence.workTypes = work;
  if (work > 0) {
    reasons.push({
      code: "work_type",
      label: `工事種別が重なっている（一致度 ${Math.round(work * 100)}%）`,
      weight: 0.35 * work,
    });
  }

  const processes = jaccard(seed.processNames ?? [], candidate.processNames);
  evidence.processes = processes;
  if (processes > 0) {
    reasons.push({
      code: "process",
      label: `工程構成が近い（一致度 ${Math.round(processes * 100)}%）`,
      weight: 0.25 * processes,
    });
  }

  const seedDays = seed.durationDays;
  const candDays = candidate.durationDays ?? candidate.features.durationDays;
  let duration = 0;
  if (seedDays && candDays) {
    duration = Math.max(0, 1 - Math.abs(seedDays - candDays) / Math.max(seedDays, candDays, 1));
  }
  evidence.duration = duration;
  if (duration > 0.4) {
    reasons.push({
      code: "duration",
      label: `工期が近い（種 ${seedDays}日 / 相手 ${candDays}日）`,
      weight: 0.15 * duration,
    });
  }

  const seedBand = seed.scaleBand ?? durationBand(seedDays);
  const candBand = candidate.features.scaleBand ?? durationBand(candDays);
  const scale = seedBand && candBand && seedBand === candBand ? 1 : 0;
  evidence.scale = scale;
  if (scale) {
    reasons.push({
      code: "scale",
      label: `規模帯が同じ（${seedBand}）`,
      weight: 0.1,
    });
  }

  const pref =
    seed.region?.prefecture && seed.region.prefecture === candidate.features.region?.prefecture ? 1 : 0;
  evidence.region = pref;
  if (pref) {
    reasons.push({
      code: "region",
      label: `地域が近い（${seed.region?.prefecture}）`,
      weight: 0.1,
    });
  }

  const summary = jaccard([...tokens(seed.workSummary)], [...tokens(candidate.features.workSummary)]);
  evidence.summary = summary;
  if (summary > 0) {
    reasons.push({
      code: "metadata",
      label: `工事概要の語が重なっている`,
      weight: 0.05 * summary,
    });
  }

  const score = Number(
    (
      0.35 * work +
      0.25 * processes +
      0.15 * duration +
      0.1 * scale +
      0.1 * pref +
      0.05 * summary
    ).toFixed(4),
  );
  return { score, evidence, reasons: reasons.sort((a, b) => b.weight - a.weight) };
}
