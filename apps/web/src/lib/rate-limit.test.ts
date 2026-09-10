import { describe, expect, it } from "vitest";
import { decideRateLimit } from "./rate-limit-policy";

describe("high-risk rate limit fail-closed", () => {
  it("allows only an explicit true from the limiter", () => {
    expect(decideRateLimit({ data: true, error: null })).toEqual({ allowed: true });
    expect(decideRateLimit({ data: false, error: null })).toEqual({ allowed: false, reason: "limited" });
  });

  it("refuses AI / upload / billing when the limiter cannot be checked", () => {
    expect(decideRateLimit({ data: true, error: { message: "rpc down" } })).toEqual({
      allowed: false,
      reason: "unavailable",
    });
    expect(decideRateLimit({ data: null, error: { code: "57014" } })).toEqual({
      allowed: false,
      reason: "unavailable",
    });
  });
});
