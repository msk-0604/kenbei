import { describe, expect, it } from "vitest";
import { briefTodayInJapanese, buildOpsSignals } from "./rules";

describe("decision rules", () => {
  it("emits overdue and delayed signals for the same org only", () => {
    const signals = buildOpsSignals({
      organizationId: "org-a",
      overdueTasks: [{ id: "t1", projectId: "p1", title: "配筋確認" }],
      delayedProcesses: [{ id: "pr1", projectId: "p1", name: "設備" }],
      pendingConfirmCount: 3,
      pendingConfirmProjectId: "p1",
      draftReports: [],
      failedUploadCount: 5,
      reviewTasks: [],
    });
    expect(signals.every((item) => item.organizationId === "org-a")).toBe(true);
    expect(signals.some((item) => item.type === "overdue_task")).toBe(true);
    expect(briefTodayInJapanese(signals)).toContain("3件確認");
  });
});
