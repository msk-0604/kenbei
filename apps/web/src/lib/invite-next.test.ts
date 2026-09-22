import { describe, expect, it } from "vitest";
import { rememberJoinNext, resolveAuthNext } from "./invite-next-path";

describe("invite return paths", () => {
  it("5. restores only a safe join next after confirmation", () => {
    expect(rememberJoinNext("/join?token=abc123abc123abc123abc123abc123ab")).toBe(
      "/join?token=abc123abc123abc123abc123abc123ab",
    );
    expect(rememberJoinNext("https://evil.example/?next=/join")).toBe("");
    expect(resolveAuthNext("/join?token=abc123abc123abc123abc123abc123ab", "")).toBe(
      "/join?token=abc123abc123abc123abc123abc123ab",
    );
    expect(resolveAuthNext("//evil", "/join?token=abc123abc123abc123abc123abc123ab")).toBe(
      "/join?token=abc123abc123abc123abc123abc123ab",
    );
  });
});
