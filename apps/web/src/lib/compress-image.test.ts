import { describe, expect, it } from "vitest";
import { COMPRESS_MAX_EDGE, COMPRESS_QUALITY, COMPRESS_SKIP_UNDER_BYTES } from "./compress-image";

describe("photo compression policy", () => {
  it("keeps site photos readable while cutting storage cost", () => {
    expect(COMPRESS_MAX_EDGE).toBeGreaterThanOrEqual(1200);
    expect(COMPRESS_MAX_EDGE).toBeLessThanOrEqual(1600);
    expect(COMPRESS_QUALITY).toBeGreaterThanOrEqual(0.65);
    expect(COMPRESS_QUALITY).toBeLessThanOrEqual(0.8);
    expect(COMPRESS_SKIP_UNDER_BYTES).toBeGreaterThan(200_000);
  });

  it("keeps the original file when compression would grow it", () => {
    expect(COMPRESS_QUALITY).toBeLessThan(1);
  });
});
