import { describe, expect, it } from "vitest";
import { hideAppChrome, isAnonymousPublicPath } from "./public-path";

describe("public marketing routes", () => {
  it("allows anonymous visitors onto the landing and legal pages", () => {
    expect(isAnonymousPublicPath("/")).toBe(true);
    expect(isAnonymousPublicPath("/privacy")).toBe(true);
    expect(isAnonymousPublicPath("/terms")).toBe(true);
    expect(isAnonymousPublicPath("/contact")).toBe(true);
    expect(isAnonymousPublicPath("/login")).toBe(true);
    expect(isAnonymousPublicPath("/projects")).toBe(false);
  });

  it("hides app chrome on marketing pages and on / only when signed out", () => {
    expect(hideAppChrome("/", false)).toBe(true);
    expect(hideAppChrome("/", true)).toBe(false);
    expect(hideAppChrome("/privacy", true)).toBe(true);
    expect(hideAppChrome("/terms", false)).toBe(true);
    expect(hideAppChrome("/contact", true)).toBe(true);
    expect(hideAppChrome("/photos", true)).toBe(false);
  });
});
