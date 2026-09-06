import { describe, expect, it } from "vitest";
import { addDaysIso, isProcessDelayed, isTaskOverdue } from "./ops-logic";
import { preferReportDraft } from "./report-draft-logic";

describe("ops logic", () => {
  it("flags overdue open tasks", () => {
    expect(isTaskOverdue({ status: "todo", dueOn: "2026-09-01", todayIso: "2026-09-04" })).toBe(true);
    expect(isTaskOverdue({ status: "done", dueOn: "2026-09-01", todayIso: "2026-09-04" })).toBe(false);
  });

  it("flags delayed processes", () => {
    expect(
      isProcessDelayed({
        status: "in_progress",
        percent: 40,
        plannedEndOn: "2026-09-01",
        todayIso: "2026-09-04",
      }),
    ).toBe(true);
    expect(
      isProcessDelayed({
        status: "completed",
        percent: 100,
        plannedEndOn: "2026-09-01",
        todayIso: "2026-09-04",
      }),
    ).toBe(false);
  });

  it("adds days on iso dates", () => {
    expect(addDaysIso("2026-09-04", 1)).toBe("2026-09-05");
  });
});

describe("report draft merge", () => {
  it("keeps newer local draft over older server", () => {
    const local = {
      updatedAt: 200,
      body: "local",
      photoIds: ["a"],
    };
    const server = {
      updatedAt: 100,
      body: "server",
      photoIds: ["b"],
    };
    expect(preferReportDraft(local, server).body).toBe("local");
    expect(preferReportDraft(null, server).body).toBe("server");
  });
});
