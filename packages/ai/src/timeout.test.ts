import { describe, expect, it } from "vitest";
import {
  AiTimeoutError,
  DEFAULT_AI_TIMEOUT_MS,
  aiTimeoutMs,
  isAiTimeoutError,
} from "./timeout";

describe("ai timeout config", () => {
  it("uses a single default and clamps env overrides", () => {
    expect(aiTimeoutMs({})).toBe(DEFAULT_AI_TIMEOUT_MS);
    expect(aiTimeoutMs({ KENBEI_AI_TIMEOUT_MS: "40000" })).toBe(40_000);
    expect(aiTimeoutMs({ KENBEI_AI_TIMEOUT_MS: "500" })).toBe(DEFAULT_AI_TIMEOUT_MS);
    expect(aiTimeoutMs({ KENBEI_AI_TIMEOUT_MS: "999999" })).toBe(DEFAULT_AI_TIMEOUT_MS);
  });

  it("distinguishes timeout errors from other failures", () => {
    expect(isAiTimeoutError(new AiTimeoutError())).toBe(true);
    const aborted = new Error("aborted");
    aborted.name = "AbortError";
    expect(isAiTimeoutError(aborted)).toBe(true);
    expect(isAiTimeoutError(new Error("OpenAI transcription failed: 500"))).toBe(false);
  });
});
