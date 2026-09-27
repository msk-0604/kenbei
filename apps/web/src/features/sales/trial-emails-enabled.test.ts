import { afterEach, describe, expect, it } from "vitest";
import { trialEmailsEnabled } from "./trial-emails-enabled";

describe("trialEmailsEnabled", () => {
  afterEach(() => {
    delete process.env.KENBEI_TRIAL_EMAILS_ENABLED;
  });

  it("stays off unless explicitly set to 1", () => {
    delete process.env.KENBEI_TRIAL_EMAILS_ENABLED;
    expect(trialEmailsEnabled()).toBe(false);
    process.env.KENBEI_TRIAL_EMAILS_ENABLED = "0";
    expect(trialEmailsEnabled()).toBe(false);
    process.env.KENBEI_TRIAL_EMAILS_ENABLED = "1";
    expect(trialEmailsEnabled()).toBe(true);
  });
});
