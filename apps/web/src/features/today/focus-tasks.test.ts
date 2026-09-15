import { describe, expect, it } from "vitest";
import { pickTodayFocusTasks } from "./focus-tasks";

describe("pickTodayFocusTasks", () => {
  const names = new Map([["p1", "A棟"], ["p2", "B棟"]]);

  it("prioritizes overdue then due today without exceeding the limit", () => {
    const picked = pickTodayFocusTasks(
      [
        { id: "1", projectId: "p1", title: "配管", status: "todo", dueOn: "2026-09-10" },
        { id: "2", projectId: "p2", title: "墨出し", status: "todo", dueOn: "2026-09-15" },
        { id: "3", projectId: "p1", title: "検査", status: "in_progress", dueOn: "2026-09-20" },
        { id: "4", projectId: "p1", title: "来月", status: "todo", dueOn: "2026-10-01" },
      ],
      names,
      "2026-09-15",
      8,
    );
    expect(picked.map((row) => row.id)).toEqual(["1", "2", "3"]);
    expect(picked[0]?.overdue).toBe(true);
    expect(picked[1]?.dueToday).toBe(true);
  });
});
