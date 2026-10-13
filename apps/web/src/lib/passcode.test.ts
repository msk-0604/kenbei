import { describe, expect, it } from "vitest";
import {
  generateLoginCode,
  hashPasscode,
  isValidLoginCode,
  isValidPasscode,
  normalizeLoginCode,
  normalizePasscode,
  verifyPasscode,
} from "./passcode";

describe("passcode login", () => {
  it("normalizes full-width characters and spaces", () => {
    expect(normalizePasscode(" ａｌｐｈａ　２０２６ ")).toBe("alpha2026");
    expect(normalizeLoginCode("１２３ ４５６")).toBe("123456");
  });

  it("validates lengths", () => {
    expect(isValidPasscode("abc")).toBe(false);
    expect(isValidPasscode("abcd")).toBe(true);
    expect(isValidPasscode("a".repeat(51))).toBe(false);
    expect(isValidLoginCode("012345")).toBe(true);
    expect(isValidLoginCode("12345")).toBe(false);
    expect(isValidLoginCode(generateLoginCode())).toBe(true);
  });

  it("hashes with a fresh salt and verifies only the same passcode", async () => {
    const a = await hashPasscode("さくら2026");
    const b = await hashPasscode("さくら2026");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(await verifyPasscode("さくら2026", a)).toBe(true);
    expect(await verifyPasscode("さくら2027", a)).toBe(false);
    expect(await verifyPasscode("さくら2026", "sha256$abc")).toBe(false);
  });
});
