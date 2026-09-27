import { readServerEnv } from "../../lib/server-env";

/** Production stays off until this is explicitly set to 1 after approval. */
export function trialEmailsEnabled(): boolean {
  return readServerEnv("KENBEI_TRIAL_EMAILS_ENABLED") === "1";
}
