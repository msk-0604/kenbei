import { describe, expect, it } from "vitest";
import { resolveAppUrl } from "./app-url";

describe("resolveAppUrl", () => {
  it("allows localhost only outside production", () => {
    expect(resolveAppUrl(undefined, false)).toBe("http://localhost:3000");
    expect(resolveAppUrl("https://app.kenbei.jp/", false)).toBe("https://app.kenbei.jp");
  });

  it("rejects missing or localhost URL in production", () => {
    expect(() => resolveAppUrl(undefined, true)).toThrow(/NEXT_PUBLIC_APP_URL/);
    expect(() => resolveAppUrl("http://localhost:3000", true)).toThrow(/NEXT_PUBLIC_APP_URL/);
    expect(() => resolveAppUrl("http://app.kenbei.jp", true)).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("accepts the official production origin", () => {
    expect(resolveAppUrl("https://app.kenbei.jp", true)).toBe("https://app.kenbei.jp");
  });
});
