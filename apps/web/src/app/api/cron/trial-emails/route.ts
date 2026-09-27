import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/features/cron/authorize";
import { insertFunnelEvent, type FunnelAdmin } from "@/features/sales/funnel-store";
import { sendTrialLifecycleEmail, type EmailAdmin } from "@/features/sales/trial-email-send";
import { dueTrialEmailKinds } from "@/features/sales/trial-email-schedule";
import { trialEmailsEnabled } from "@/features/sales/trial-emails-enabled";
import { readServerEnv } from "@/lib/server-env";
import { logServerInfo, logServerWarn } from "@/lib/server-log";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type BillingRow = {
  organization_id: string;
  status: string;
  trial_ends_at: string | null;
};

async function ownerEmail(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  organizationId: string,
): Promise<string | null> {
  const memberships = await admin
    .from("memberships")
    .select("profile_id, role_id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("deleted_at", null);
  const rows = (memberships.data as { profile_id: string; role_id: string }[] | null) ?? [];
  if (rows.length === 0) {
    return null;
  }
  const roles = await admin
    .from("roles")
    .select("id, code")
    .in(
      "id",
      rows.map((row) => row.role_id),
    );
  const ownerRoleIds = new Set(
    ((roles.data as { id: string; code: string }[] | null) ?? [])
      .filter((role) => role.code === "owner")
      .map((role) => role.id),
  );
  const owner = rows.find((row) => ownerRoleIds.has(row.role_id));
  if (!owner) {
    return null;
  }
  const user = await admin.auth.admin.getUserById(owner.profile_id);
  const email = user.data.user?.email?.trim();
  return email || null;
}

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  const secret = readServerEnv("CRON_SECRET");
  if (!isCronAuthorized(request.headers, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!trialEmailsEnabled()) {
    await logServerInfo("cron.trial-emails", { skipped: "disabled" });
    return NextResponse.json({ ok: true, skipped: "disabled" });
  }
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const now = new Date();
  const billing = await admin
    .from("organization_billing")
    .select("organization_id, status, trial_ends_at")
    .eq("status", "trialing")
    .not("trial_ends_at", "is", null)
    .limit(200);
  if (billing.error) {
    await logServerWarn("cron.trial-emails", { reason: "billing_query" });
    return NextResponse.json({ ok: true, skipped: "query" });
  }
  const rows = (billing.data as BillingRow[] | null) ?? [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of rows) {
    const history = await admin
      .from("trial_lifecycle_emails")
      .select("kind, status")
      .eq("organization_id", row.organization_id);
    if (history.error) {
      skipped += 1;
      continue;
    }
    const sentKinds = ((history.data as { kind: string; status: string }[] | null) ?? [])
      .filter((item) => item.status === "sent")
      .map((item) => item.kind);
    const due = dueTrialEmailKinds({
      now,
      trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at) : null,
      status: row.status,
      sentKinds,
    });
    if (due.length === 0) {
      continue;
    }
    const email = await ownerEmail(admin, row.organization_id);
    if (!email) {
      skipped += 1;
      continue;
    }
    for (const kind of due) {
      const result = await sendTrialLifecycleEmail({
        admin: admin as unknown as EmailAdmin,
        organizationId: row.organization_id,
        kind,
        recipientEmail: email,
        now,
      });
      if (result === "sent") {
        sent += 1;
        if (kind === "trial_started") {
          await insertFunnelEvent(admin as unknown as FunnelAdmin, {
            visitorId: `org:${row.organization_id}`,
            organizationId: row.organization_id,
            kind: "trial_started",
          });
        }
      } else if (result === "failed") {
        failed += 1;
      } else {
        skipped += 1;
      }
    }
  }
  await logServerInfo("cron.trial-emails", { scanned: rows.length, sent, failed, skipped });
  return NextResponse.json({ ok: true, scanned: rows.length, sent, failed, skipped });
}
