import { describe, expect, it } from "vitest";
import { taskStatusActionLabel, taskStatusButtonView, taskStatusSuccessMessage } from "./task-status-ui";

describe("task status button view", () => {
  it("marks the optimistic status selected and pending immediately", () => {
    const view = taskStatusButtonView("in_progress", "in_progress", "in_progress");
    expect(view.selected).toBe(true);
    expect(view.updating).toBe(true);
    expect(view.disabled).toBe(true);
  });

  it("disables other statuses while one update is in flight", () => {
    const other = taskStatusButtonView("in_progress", "in_progress", "todo");
    expect(other.selected).toBe(false);
    expect(other.updating).toBe(false);
    expect(other.disabled).toBe(true);
  });

  it("keeps the committed status selected when idle", () => {
    const view = taskStatusButtonView("done", null, "done");
    expect(view.selected).toBe(true);
    expect(view.updating).toBe(false);
    expect(view.disabled).toBe(false);
  });
});

describe("task status copy", () => {
  it("uses result-clear labels for done", () => {
    expect(taskStatusActionLabel("done", "完了")).toBe("完了にする");
    expect(taskStatusSuccessMessage("done")).toBe("✓ 完了しました");
  });
});
