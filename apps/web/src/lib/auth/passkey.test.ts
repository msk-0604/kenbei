import { describe, expect, it } from "vitest";
import { base64UrlToBytes, bytesToBase64Url, deviceNameFromUserAgent, isAllowedPasskeyHost, relyingParty } from "./passkey";

describe("relyingParty", () => {
  it("uses the host the user opened", () => {
    expect(relyingParty("app.kenbei.jp", "https")).toEqual({ rpID: "app.kenbei.jp", origin: "https://app.kenbei.jp" });
    expect(relyingParty("localhost:3000", "http")).toEqual({ rpID: "localhost", origin: "http://localhost:3000" });
  });

  it("never downgrades a real host to http", () => {
    expect(relyingParty("app.kenbei.jp", "http")?.origin).toBe("https://app.kenbei.jp");
  });

  it("rejects missing or odd hosts", () => {
    expect(relyingParty("", "https")).toBeNull();
    expect(relyingParty("evil.com/@app.kenbei.jp", "https")).toBeNull();
  });
});

describe("isAllowedPasskeyHost", () => {
  it("allows production, Vercel previews and localhost only", () => {
    expect(isAllowedPasskeyHost("app.kenbei.jp", "https://app.kenbei.jp")).toBe(true);
    expect(isAllowedPasskeyHost("kenbei-web-git-x.vercel.app", "https://app.kenbei.jp")).toBe(true);
    expect(isAllowedPasskeyHost("localhost", "https://app.kenbei.jp")).toBe(true);
    expect(isAllowedPasskeyHost("evil.example", "https://app.kenbei.jp")).toBe(false);
    expect(isAllowedPasskeyHost("a.b.vercel.app", "https://app.kenbei.jp")).toBe(false);
  });
});

describe("helpers", () => {
  it("round-trips public keys", () => {
    const bytes = new Uint8Array([0, 1, 250, 255]);
    expect(Array.from(base64UrlToBytes(bytesToBase64Url(bytes)))).toEqual([0, 1, 250, 255]);
  });

  it("names devices", () => {
    expect(deviceNameFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("iPhone");
    expect(deviceNameFromUserAgent("Mozilla/5.0 (Linux; Android 15)")).toBe("Android");
    expect(deviceNameFromUserAgent(null)).toBe("この端末");
  });
});
