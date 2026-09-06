import { describe, expect, it } from "vitest";
import { parseKenbeiRoute } from "./deep-link";
import { nextDrawingVersion } from "./drawing-logic";

describe("mobile deep link", () => {
  it("opens confirm and project", () => {
    expect(parseKenbeiRoute("kenbei://confirm")).toEqual({ type: "confirm" });
    expect(parseKenbeiRoute("/projects/11111111-1111-1111-1111-111111111111")).toEqual({
      type: "project",
      projectId: "11111111-1111-1111-1111-111111111111",
    });
  });
});

describe("drawing version", () => {
  it("increments latest", () => {
    expect(nextDrawingVersion({ id: "a", version: 1, seriesId: "s" }).version).toBe(2);
  });
});
