import { describe, expect, it } from "vitest";
import { needsRealName, normalizeDisplayName } from "./display-name";

describe("display name", () => {
  it("asks for a real name while it is still the e-mail", () => {
    expect(needsRealName("yamamasaki0604", "yamamasaki0604@icloud.com")).toBe(true);
    expect(needsRealName("yamamasaki0604@icloud.com", "yamamasaki0604@icloud.com")).toBe(true);
    expect(needsRealName("", "a@b.jp")).toBe(true);
    expect(needsRealName("山本 真樹", "yamamasaki0604@icloud.com")).toBe(false);
  });

  it("trims and caps names", () => {
    expect(normalizeDisplayName("  山本　 真樹 ")).toBe("山本 真樹");
    expect(normalizeDisplayName("あ".repeat(50))).toHaveLength(40);
  });
});
