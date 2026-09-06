import { describe, expect, it } from "vitest";
import { structureTranscriptHeuristic } from "./heuristic";

describe("heuristic structure", () => {
  it("extracts plumbing material without an LLM", () => {
    const fields = structureTranscriptHeuristic(
      "今日は3階の給水配管。HI25を12本使用。明日続きを行います。",
      {
        organizationId: "org",
        workOn: "2026-08-17",
        knownWorkerNames: [],
        knownMaterialCodes: ["HI25"],
        knownLocationHints: [],
        currentProcessNames: [],
      },
    );
    const byKey = Object.fromEntries(fields.map((field) => [field.key, field]));
    expect(byKey.work_type?.value).toBe("給排水");
    expect(byKey.material?.value).toBe("HI25");
    expect(byKey.quantity?.value).toBe(12);
    expect(byKey.location?.value).toBe("3階");
    expect(byKey.material?.needsConfirmation).toBe(false);
    expect(byKey.next_action?.needsConfirmation).toBe(true);
  });
});
