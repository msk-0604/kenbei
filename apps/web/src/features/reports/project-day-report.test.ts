import { describe, expect, it } from "vitest";
import { pickProjectDayReport } from "./project-day-report";

describe("pickProjectDayReport", () => {
  it("returns null when empty", () => {
    expect(pickProjectDayReport([])).toBeNull();
  });

  it("prefers the legacy project-day row over assignment reports", () => {
    const picked = pickProjectDayReport([
      { id: "v2", task_id: "task-1", status: "draft", updated_at: "2026-10-01T12:00:00Z" },
      { id: "legacy", task_id: null, status: "draft", updated_at: "2026-10-01T08:00:00Z" },
    ]);
    expect(picked?.id).toBe("legacy");
  });

  it("uses the newest row when every report is assignment-scoped", () => {
    const picked = pickProjectDayReport([
      { id: "old", taskId: "a", updatedAt: "2026-10-01T08:00:00Z" },
      { id: "new", taskId: "b", updatedAt: "2026-10-01T11:00:00Z" },
    ]);
    expect(picked?.id).toBe("new");
  });
});
