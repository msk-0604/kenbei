import { describe, expect, it } from "vitest";
import { toUserActionError } from "./user-error";

describe("toUserActionError", () => {
  it("replaces technical errors with a next step", () => {
    const message = toUserActionError("Failed to update task", "タスクを更新");
    expect(message).toContain("タスクを更新できませんでした");
    expect(message).toContain("もう一度押してください");
    expect(message).not.toContain("Failed");
  });

  it("keeps Japanese permission errors", () => {
    expect(toUserActionError("更新する権限がありません。", "タスクを更新")).toBe("更新する権限がありません。");
  });

  it("does not mix a plan limit with a network retry", () => {
    expect(toUserActionError("4名以上は STANDARD（月額39,800円）が必要です。", "招待リンクを作成")).toBe(
      "4名以上は STANDARD（月額39,800円）が必要です。",
    );
  });
});
