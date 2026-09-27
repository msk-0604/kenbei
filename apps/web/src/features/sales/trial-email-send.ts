import "server-only";

import { getAppUrl } from "../../lib/env";
import { sendKenbeiEmail } from "../../lib/mail";
import { deliverTrialLifecycleEmail, type EmailAdmin } from "./trial-email-deliver";
import type { TrialEmailKind } from "./trial-email-schedule";
import { trialEmailsEnabled } from "./trial-emails-enabled";

export type { EmailAdmin } from "./trial-email-deliver";

export async function sendTrialLifecycleEmail(input: {
  admin: EmailAdmin;
  organizationId: string;
  kind: TrialEmailKind;
  recipientEmail: string;
  now?: Date;
}): Promise<"sent" | "skipped" | "failed" | "disabled" | "missing"> {
  return deliverTrialLifecycleEmail({
    ...input,
    enabled: trialEmailsEnabled(),
    appUrl: getAppUrl(),
    sendMail: sendKenbeiEmail,
  });
}
