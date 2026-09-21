import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./authorize";

function headers(init: Record<string, string>) {
  return {
    get(name: string) {
      return init[name.toLowerCase()] ?? null;
    },
  };
}

describe("cron authorize", () => {
  it("rejects missing secret and wrong credentials", () => {
    expect(isCronAuthorized(headers({ authorization: "Bearer x" }), undefined)).toBe(false);
    expect(isCronAuthorized(headers({ authorization: "Bearer x" }), "")).toBe(false);
    expect(isCronAuthorized(headers({ authorization: "Bearer wrong" }), "secret")).toBe(false);
    expect(isCronAuthorized(headers({}), "secret")).toBe(false);
  });

  it("accepts bearer or x-cron-secret", () => {
    expect(isCronAuthorized(headers({ authorization: "Bearer secret" }), "secret")).toBe(true);
    expect(isCronAuthorized(headers({ "x-cron-secret": "secret" }), "secret")).toBe(true);
  });
});
