import { describe, expect, it } from "vitest";
import { diagnoseCronSecret, isCronDiagRequest } from "./cron-secret-diag";

function headers(init: Record<string, string>) {
  return {
    get(name: string) {
      return init[name.toLowerCase()] ?? null;
    },
  };
}

describe("cron secret diag", () => {
  it("enables only the temporary diag header", () => {
    expect(isCronDiagRequest(headers({}))).toBe(false);
    expect(isCronDiagRequest(headers({ "x-cron-diag": "1" }))).toBe(true);
    expect(isCronDiagRequest(headers({ "x-cron-diag": "0" }))).toBe(false);
  });

  it("reports missing env as not exists with zero length", () => {
    const diag = diagnoseCronSecret(headers({ authorization: "Bearer fixture-token" }), undefined);
    expect(diag).toEqual({
      exists: false,
      trim_length: 0,
      authorization_present: true,
      bearer_prefix_ok: true,
      lengths_equal: false,
      exact_match: false,
    });
  });

  it("reports empty env as exists with zero length", () => {
    const diag = diagnoseCronSecret(headers({ authorization: "Bearer fixture-token" }), "");
    expect(diag.exists).toBe(true);
    expect(diag.trim_length).toBe(0);
    expect(diag.exact_match).toBe(false);
  });

  it("distinguishes length match from exact match", () => {
    const diag = diagnoseCronSecret(headers({ authorization: "Bearer abcdef" }), "uvwxyz");
    expect(diag.exists).toBe(true);
    expect(diag.trim_length).toBe(6);
    expect(diag.bearer_prefix_ok).toBe(true);
    expect(diag.lengths_equal).toBe(true);
    expect(diag.exact_match).toBe(false);
  });

  it("flags exact bearer match without returning values", () => {
    const diag = diagnoseCronSecret(headers({ authorization: "Bearer fixture-token" }), "fixture-token");
    expect(diag.exact_match).toBe(true);
    expect(diag.lengths_equal).toBe(true);
    expect(JSON.stringify(diag)).not.toContain("fixture-token");
  });
});
