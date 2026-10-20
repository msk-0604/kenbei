import { describe, expect, it } from "vitest";
import { cleanPhotoLabel } from "./photo-label";

describe("photo labels from the AI", () => {
  it("drops placeholder words", () => {
    for (const word of ["不明", "未定", " なし ", "建設", "Unknown", "-", ""]) {
      expect(cleanPhotoLabel(word)).toBeUndefined();
    }
    expect(cleanPhotoLabel(null)).toBeUndefined();
  });

  it("keeps real labels", () => {
    expect(cleanPhotoLabel("給排水")).toBe("給排水");
    expect(cleanPhotoLabel(" 2階トイレ ")).toBe("2階トイレ");
  });
});
