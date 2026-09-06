import { describe, expect, it } from "vitest";
import { canDeliverPushToken, nextDrawingVersion, parseKenbeiRoute } from "./notify";

describe("canDeliverPushToken", () => {
  const base = {
    tokenOrganizationId: "org-a",
    tokenProfileId: "user-a",
    tokenActive: true,
    targetOrganizationId: "org-a",
    targetProfileId: "user-a",
  };

  it("allows the matching org and user", () => {
    expect(canDeliverPushToken(base)).toBe(true);
  });

  it("blocks another organization", () => {
    expect(canDeliverPushToken({ ...base, tokenOrganizationId: "org-b" })).toBe(false);
  });

  it("blocks another user", () => {
    expect(canDeliverPushToken({ ...base, tokenProfileId: "user-b" })).toBe(false);
  });

  it("blocks inactive tokens", () => {
    expect(canDeliverPushToken({ ...base, tokenActive: false })).toBe(false);
  });
});

describe("parseKenbeiRoute", () => {
  it("parses confirm, project, task, report, drawing", () => {
    expect(parseKenbeiRoute("/confirm")).toEqual({ type: "confirm" });
    expect(parseKenbeiRoute("kenbei://projects/11111111-1111-1111-1111-111111111111")).toEqual({
      type: "project",
      projectId: "11111111-1111-1111-1111-111111111111",
    });
    expect(parseKenbeiRoute("/tasks/11111111-1111-1111-1111-111111111111")).toEqual({
      type: "task",
      taskId: "11111111-1111-1111-1111-111111111111",
    });
    expect(parseKenbeiRoute("/reports/11111111-1111-1111-1111-111111111111", { projectId: "p" })).toEqual({
      type: "report",
      reportId: "11111111-1111-1111-1111-111111111111",
      projectId: "p",
    });
    expect(parseKenbeiRoute("/drawings/11111111-1111-1111-1111-111111111111")).toEqual({
      type: "drawing",
      drawingId: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("prefers payload ids for deep links", () => {
    expect(
      parseKenbeiRoute("/confirm", { taskId: "11111111-1111-1111-1111-111111111111", projectId: "p" }),
    ).toEqual({
      type: "task",
      taskId: "11111111-1111-1111-1111-111111111111",
      projectId: "p",
    });
  });
});

describe("nextDrawingVersion", () => {
  it("starts at v1 then increments and supersedes", () => {
    expect(nextDrawingVersion(null)).toEqual({
      version: 1,
      seriesId: null,
      supersedesId: null,
      markPreviousLatestFalse: false,
    });
    expect(nextDrawingVersion({ id: "old", version: 2, seriesId: "series" })).toEqual({
      version: 3,
      seriesId: "series",
      supersedesId: "old",
      markPreviousLatestFalse: true,
    });
  });
});
