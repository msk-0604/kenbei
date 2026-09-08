import { describe, expect, it } from "vitest";
import { resolveAiModel } from "./models";
import {
  isAllowedStrategistTool,
  isBlockedStrategistTool,
  routeStrategistHeuristically,
  sanitizeStrategistToolArgs,
} from "./agent-policy";

describe("ai models", () => {
  it("falls back to gpt-4o-mini and honors env overrides", () => {
    expect(resolveAiModel("default", {})).toBe("gpt-4o-mini");
    expect(resolveAiModel("light", { KENBEI_AI_MODEL_LIGHT: "gpt-4o-mini" })).toBe("gpt-4o-mini");
    expect(resolveAiModel("reasoning", { KENBEI_AI_MODEL_REASONING: "gpt-4o-mini" })).toBe("gpt-4o-mini");
  });
});

describe("strategist policy", () => {
  it("allowlists read/propose tools and blocks dangerous names", () => {
    expect(isAllowedStrategistTool("get_overdue_tasks")).toBe(true);
    expect(isAllowedStrategistTool("delete_report")).toBe(false);
    expect(isBlockedStrategistTool("stripe_checkout")).toBe(true);
    expect(isBlockedStrategistTool("confirm_report")).toBe(true);
    expect(isBlockedStrategistTool("invite_member")).toBe(true);
  });

  it("drops tenant fields from model args", () => {
    const clean = sanitizeStrategistToolArgs({
      organizationId: "00000000-0000-4000-a000-000000000099",
      permission: "org.manage",
      projectId: "00000000-0000-4000-a000-000000000001",
      titles: ["配筋確認"],
    });
    expect(clean.projectId).toBe("00000000-0000-4000-a000-000000000001");
    expect(clean.titles).toEqual(["配筋確認"]);
    expect("organizationId" in clean.extra).toBe(false);
  });

  it("routes Japanese requests to tools", () => {
    expect(routeStrategistHeuristically("期限切れのタスクを教えて").tools).toContain("get_overdue_tasks");
    expect(routeStrategistHeuristically("今日の日報を作って").wantsProposal).toBe("report");
    expect(routeStrategistHeuristically("似た現場を探して").tools).toContain("get_similar_projects");
  });
});
