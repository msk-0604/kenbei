import { describe, expect, it } from "vitest";
import {
  TASK_DEADLINE_PAGE_SIZE,
  nextTaskDeadlineCursor,
  shouldFetchNextTaskDeadlinePage,
  taskDeadlineOrFilter,
} from "./task-deadline-cursor";

describe("task deadline cursor", () => {
  it("pages past the first 200 rows instead of dropping the rest", () => {
    const page = Array.from({ length: TASK_DEADLINE_PAGE_SIZE }, (_, index) => ({
      id: `task-${String(index).padStart(4, "0")}`,
      due_on: "2026-09-10",
    }));
    expect(shouldFetchNextTaskDeadlinePage(page.length)).toBe(true);
    const cursor = nextTaskDeadlineCursor(page);
    expect(cursor).toEqual({ dueOn: "2026-09-10", id: "task-0199" });
    expect(taskDeadlineOrFilter(cursor!)).toContain("id.gt.task-0199");
  });

  it("stops when a short page is returned", () => {
    expect(shouldFetchNextTaskDeadlinePage(3)).toBe(false);
    expect(nextTaskDeadlineCursor([])).toBeNull();
  });
});
