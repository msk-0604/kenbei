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

describe("photoSaveErrorMessage", () => {
  it("names the cause instead of always blaming the connection", async () => {
    const { photoSaveErrorMessage } = await import("./upload-safety");
    expect(photoSaveErrorMessage("new row violates row-level security policy")).toMatch(/権限/);
    expect(photoSaveErrorMessage("Bucket not found")).toMatch(/保存先/);
    expect(photoSaveErrorMessage("The object exceeded the maximum allowed size")).toMatch(/サイズ/);
    expect(photoSaveErrorMessage("TypeError: Load failed")).toMatch(/通信/);
    expect(photoSaveErrorMessage("something odd")).toMatch(/原因: something odd/);
  });
});
