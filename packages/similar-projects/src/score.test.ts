import { describe, expect, it } from "vitest";
import { RuleBasedSimilarProjectEngine, scoreAgainstSeed } from "./index";
import type { SimilarProjectCandidate } from "./score";

const org = "org-a";

function candidate(partial: Partial<SimilarProjectCandidate> & { projectId: string }): SimilarProjectCandidate {
  return {
    organizationId: org,
    name: partial.name ?? partial.projectId,
    features: {
      workTypes: ["給排水"],
      workSummary: "給水配管更新",
      region: { prefecture: "東京都" },
      durationDays: 60,
      ...partial.features,
    },
    processNames: ["配管", "試運転"],
    delayedCount: 0,
    taskTitles: ["試運転立会"],
    incidents: [],
    lessons: ["開口部養生を先に"],
    durationDays: 60,
    ...partial,
  };
}

describe("similar project scoring", () => {
  it("explains overlapping work type and drops other orgs", async () => {
    const engine = new RuleBasedSimilarProjectEngine();
    const result = await engine.findSimilar({
      organizationId: org,
      excludeProjectId: "seed",
      seed: {
        workTypes: ["給排水"],
        processNames: ["配管"],
        workSummary: "給水配管",
        durationDays: 55,
        region: { prefecture: "東京都" },
      },
      candidates: [
        candidate({ projectId: "near", delayedCount: 1 }),
        candidate({
          projectId: "other-org",
          organizationId: "org-b",
          name: "他社",
        }),
        candidate({
          projectId: "unlike",
          features: { workTypes: ["塗装"], workSummary: "外壁", durationDays: 10 },
          processNames: ["塗装"],
          durationDays: 10,
        }),
      ],
    });
    expect(result.matches.every((item) => item.projectId !== "other-org")).toBe(true);
    expect(result.matches.every((item) => item.projectId !== "unlike")).toBe(true);
    expect(result.matches[0]?.projectId).toBe("near");
    expect(result.matches[0]?.reasons.some((item) => item.code === "work_type")).toBe(true);
    expect(result.stats.flagRates.delayed?.hit).toBe(1);
  });

  it("returns zero when nothing overlaps", () => {
    const scored = scoreAgainstSeed(
      { workTypes: ["電気"] },
      candidate({ projectId: "x", features: { workTypes: ["土木"] }, processNames: [] }),
    );
    expect(scored.score).toBe(0);
    expect(scored.reasons).toEqual([]);
  });
});
