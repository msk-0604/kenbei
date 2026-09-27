import { isMissingSalesTable, isUniqueSalesConstraint } from "./missing-table";
import { trialEmailCopy } from "./trial-email-copy";
import { canRetryTrialEmail, nextTrialEmailRetryAt, TRIAL_EMAIL_MAX_ATTEMPTS } from "./trial-email-retry";
import type { TrialEmailKind } from "./trial-email-schedule";

type EmailQuery = {
  select: (columns: string) => EmailQuery;
  eq: (column: string, value: string) => EmailQuery;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }>;
  insert: (row: Record<string, unknown>) => Promise<{ error: { code?: string; message?: string } | null }>;
  update: (row: Record<string, unknown>) => EmailQuery;
};

export type EmailAdmin = {
  from: (table: string) => EmailQuery;
};

export type TrialMailSender = (input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) => Promise<{ ok: true } | { ok: false; error: string }>;

export async function deliverTrialLifecycleEmail(input: {
  admin: EmailAdmin;
  organizationId: string;
  kind: TrialEmailKind;
  recipientEmail: string;
  now?: Date;
  enabled: boolean;
  appUrl: string;
  sendMail: TrialMailSender;
}): Promise<"sent" | "skipped" | "failed" | "disabled" | "missing"> {
  if (!input.enabled) {
    return "disabled";
  }
  const now = input.now ?? new Date();
  const existing = await input.admin
    .from("trial_lifecycle_emails")
    .select("organization_id, kind, recipient_email, status, attempt_count, next_retry_at")
    .eq("organization_id", input.organizationId)
    .eq("kind", input.kind)
    .maybeSingle();
  if (isMissingSalesTable(existing.error)) {
    return "missing";
  }
  const row = existing.data as {
    status: string;
    attempt_count: number;
    next_retry_at: string | null;
  } | null;
  if (row?.status === "sent") {
    return "skipped";
  }
  if (
    row &&
    !canRetryTrialEmail({
      status: row.status,
      attemptCount: row.attempt_count,
      nextRetryAt: row.next_retry_at,
      now,
    })
  ) {
    return "skipped";
  }
  if (!row) {
    const inserted = await input.admin.from("trial_lifecycle_emails").insert({
      organization_id: input.organizationId,
      kind: input.kind,
      recipient_email: input.recipientEmail,
      status: "pending",
      attempt_count: 0,
      updated_at: now.toISOString(),
    });
    if (isMissingSalesTable(inserted.error)) {
      return "missing";
    }
    if (inserted.error && !isUniqueSalesConstraint(inserted.error)) {
      return "failed";
    }
  }
  const copy = trialEmailCopy(input.kind, input.appUrl);
  const sent = await input.sendMail({
    to: input.recipientEmail,
    subject: copy.subject,
    text: copy.text,
    html: copy.html,
  });
  const attemptCount = (row?.attempt_count ?? 0) + 1;
  if (sent.ok) {
    await input.admin
      .from("trial_lifecycle_emails")
      .update({
        status: "sent",
        attempt_count: attemptCount,
        sent_at: now.toISOString(),
        last_error: null,
        next_retry_at: null,
        recipient_email: input.recipientEmail,
        updated_at: now.toISOString(),
      })
      .eq("organization_id", input.organizationId)
      .eq("kind", input.kind);
    return "sent";
  }
  await input.admin
    .from("trial_lifecycle_emails")
    .update({
      status: "failed",
      attempt_count: attemptCount,
      last_error: sent.error.slice(0, 200),
      next_retry_at: attemptCount >= TRIAL_EMAIL_MAX_ATTEMPTS ? null : nextTrialEmailRetryAt(attemptCount, now).toISOString(),
      recipient_email: input.recipientEmail,
      updated_at: now.toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("kind", input.kind);
  return "failed";
}
