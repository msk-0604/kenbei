import { describe, expect, it } from "vitest";
import { proposeTaskTitles } from "./ops-briefs";
import { classifyPhotoHeuristic } from "./photo-heuristic";
import { draftDailyReportTemplate } from "./report-draft";

describe("photo heuristic", () => {
  it("reads work type and floor from filename", () => {
    const result = classifyPhotoHeuristic("2F_トイレ_配管.jpg");
    expect(result.workType).toBe("給排水");
    expect(result.floor).toBe("2階");
    expect(result.locationSpot).toBe("トイレ");
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});

describe("report draft", () => {
  it("builds a human-editable draft without an LLM", () => {
    const draft = draftDailyReportTemplate({
      projectName: "Aマンション",
      workOn: "2026-09-03",
      authorName: "山田",
      photoNotes: ["3階 給排水"],
      taskNotes: [],
      workSummary: "給水配管",
      similarHints: ["似た現場の工期は60日"],
    });
    expect(draft.body).toContain("Aマンション");
    expect(draft.body).toContain("給水配管");
    expect(draft.body).toContain("類似現場");
    expect(draft.provider).toBe("null");
  });
});

describe("task proposals", () => {
  it("does not execute tasks, only titles", () => {
    const titles = proposeTaskTitles({
      organizationName: "A",
      pendingConfirmCount: 1,
      overdueTaskTitles: ["配筋"],
      delayedProcessNames: ["設備"],
      draftReportCount: 0,
      failedUploadCount: 0,
    });
    expect(titles.some((item) => item.includes("設備"))).toBe(true);
  });
});
