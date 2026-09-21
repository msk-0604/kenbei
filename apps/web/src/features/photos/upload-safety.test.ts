import { describe, expect, it } from "vitest";
import { isExistingStorageObject, isUniqueConstraintError } from "./upload-safety";

describe("photo upload retry safety", () => {
  it("treats storage object collisions as already uploaded", () => {
    expect(isExistingStorageObject("The resource already exists")).toBe(true);
    expect(isExistingStorageObject("Duplicate")).toBe(true);
    expect(isExistingStorageObject("network timeout")).toBe(false);
  });

  it("treats photo id unique violations as already saved", () => {
    expect(isUniqueConstraintError({ code: "23505", message: "duplicate key value" })).toBe(true);
    expect(isUniqueConstraintError({ code: "42501", message: "permission denied" })).toBe(false);
  });
});
