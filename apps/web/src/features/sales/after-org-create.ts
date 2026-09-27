import "server-only";

import { cookies } from "next/headers";
import { readAttributionFromCookies } from "@/features/sales/attribution-cookies";
import { insertFunnelEvent } from "@/features/sales/funnel-store";
import { sendTrialLifecycleEmail, type EmailAdmin } from "@/features/sales/trial-email-send";
import type { FunnelAdmin } from "@/features/sales/funnel-store";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logServerWarn } from "@/lib/server-log";

export async function afterOrganizationCreated(input: {
  organizationId: string;
  email: string | undefined;
}): Promise<void> {
  try {
    const admin = createAdminSupabaseClient();
    const store = await cookies();
    const attribution = readAttributionFromCookies(store);
    const visitorId = attribution.visitorId ?? `org:${input.organizationId}`;
    if (admin) {
      await insertFunnelEvent(admin as unknown as FunnelAdmin, {
        visitorId,
        organizationId: input.organizationId,
        kind: "trial_started",
        utm: attribution.utm,
      });
    }
    if (admin && input.email) {
      await sendTrialLifecycleEmail({
        admin: admin as unknown as EmailAdmin,
        organizationId: input.organizationId,
        kind: "trial_started",
        recipientEmail: input.email,
      });
    }
  } catch {
    await logServerWarn("sales.trial_started.followup_failed", { organizationId: input.organizationId });
  }
}
