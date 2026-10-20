import { describe, expect, it } from "vitest";
import { distinctMemberLabels } from "./member-labels";

describe("member labels in the worker form", () => {
  it("adds the role only when two people share a name", () => {
    expect(
      distinctMemberLabels([
        { displayName: "山本", roleCode: "owner" },
        { displayName: "山本", roleCode: "worker" },
        { displayName: "佐藤", roleCode: "worker" },
      ]),
    ).toEqual(["山本（代表）", "山本（一般メンバー）", "佐藤"]);
  });

  it("numbers people who still look the same", () => {
    expect(
      distinctMemberLabels([
        { displayName: "田中", roleCode: "worker" },
        { displayName: "田中", roleCode: "worker" },
      ]),
    ).toEqual(["田中（一般メンバー） 1", "田中（一般メンバー） 2"]);
  });
});
