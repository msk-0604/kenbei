import { describe, expect, it } from "vitest";
import { canSendLocalTrialEmailTest, parseTrialEmailAllowlist } from "./trial-email-test-guard";

describe("local trial email test guard", () => {
  it("allows only an explicit non-production allowlisted address", () => {
    expect(parseTrialEmailAllowlist("a@test.jp, b@test.jp")).toEqual(["a@test.jp", "b@test.jp"]);
    expect(
      canSendLocalTrialEmailTest({
        production: false,
        testFlag: "1",
        email: "A@test.jp",
        allowlistRaw: "a@test.jp",
      }),
    ).toBe(true);
    expect(
      canSendLocalTrialEmailTest({
        production: true,
        testFlag: "1",
        email: "a@test.jp",
        allowlistRaw: "a@test.jp",
      }),
    ).toBe(false);
    expect(
      canSendLocalTrialEmailTest({
        production: false,
        testFlag: "1",
        email: "customer@other.jp",
        allowlistRaw: "a@test.jp",
      }),
    ).toBe(false);
    expect(
      canSendLocalTrialEmailTest({
        production: false,
        testFlag: "0",
        email: "a@test.jp",
        allowlistRaw: "a@test.jp",
      }),
    ).toBe(false);
  });
});
