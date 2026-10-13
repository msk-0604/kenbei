import { describe, expect, it } from "vitest";
import { MOBILE_NAV, activeNavHref } from "./app-nav";

describe("bottom navigation", () => {
  it("has exactly two tabs: スケジュール and 現場一覧", () => {
    expect(MOBILE_NAV.map((item) => item.label)).toEqual(["スケジュール", "現場一覧"]);
  });

  it("keeps the right tab lit", () => {
    expect(activeNavHref("/today")).toBe("/today");
    expect(activeNavHref("/schedule/new")).toBe("/today");
    expect(activeNavHref("/sites/abc/progress")).toBe("/sites");
    expect(activeNavHref("/kanri")).toBeNull();
  });
});
