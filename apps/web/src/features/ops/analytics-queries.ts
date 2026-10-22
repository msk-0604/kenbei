import "server-only";

import { classifyBillingAccess } from "@kensapo/domain";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { describeOrgSource, type OrgOverviewRow, type OrgSourceRow } from "@/features/ops/org-health";
import { excludeInternal, type ActivityEvent, type OrgFacts } from "@/features/ops/analytics";

type ActivationRow = {
  organization_id: string;
  has_schedule: boolean;
  has_work_start: boolean;
  has_confirmed_report: boolean;
  ever_paid: boolean;
};

type DailyRow = { organization_id: string | null; day: string; kind: string; n: number };

export type OpsAnalyticsData =
  | { ok: true; orgs: OrgFacts[]; events: ActivityEvent[]; visits: { day: string; n: number }[]; excluded: number }
  | { ok: false; reason: "no_service_role" | "migration" };

/** 運営の分析に使う数字を、サービスロールで読む（呼ぶ前に PLATFORM_ADMIN_EMAILS を確かめること） */
export async function loadOpsAnalytics(adminEmails: string | null | undefined, now = new Date(), weeks = 8): Promise<OpsAnalyticsData> {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return { ok: false, reason: "no_service_role" };
  }
  const since = new Date(now.getTime() - (weeks * 7 + 7) * 86_400_000).toISOString();
  const [overview, activation, daily, sources] = await Promise.all([
    admin.rpc("platform_org_overview"),
    admin.rpc("platform_org_activation"),
    admin.rpc("platform_activity_daily", { p_since: since }),
    admin
      .from("sales_funnel_events")
      .select("organization_id, utm_source, utm_medium, utm_campaign, utm_content")
      .eq("event_kind", "trial_started")
      .not("organization_id", "is", null),
  ]);
  if (overview.error || activation.error || daily.error) {
    return { ok: false, reason: "migration" };
  }
  const activationById = new Map(((activation.data as ActivationRow[] | null) ?? []).map((row) => [row.organization_id, row]));
  const sourceById = new Map(
    ((sources.data as OrgSourceRow[] | null) ?? []).map((row) => [row.organization_id ?? "", row]),
  );
  const all: OrgFacts[] = ((overview.data as OrgOverviewRow[] | null) ?? []).map((row) => {
    const act = activationById.get(row.organization_id);
    const access = classifyBillingAccess({ planCode: row.plan_code, status: row.billing_status, trialEndsAt: row.trial_ends_at, now });
    return {
      organizationId: row.organization_id,
      name: row.name,
      createdAt: row.created_at,
      ownerEmail: row.owner_email,
      source: describeOrgSource(sourceById.get(row.organization_id)).label,
      paying: access === "paid_active",
      everPaid: Boolean(act?.ever_paid),
      hasSite: row.site_count > 0,
      hasWorker: row.worker_count > 0,
      hasSchedule: Boolean(act?.has_schedule),
      hasWorkStart: Boolean(act?.has_work_start),
      hasConfirmedReport: Boolean(act?.has_confirmed_report),
    };
  });
  const orgs = excludeInternal(all, adminEmails);
  const kept = new Set(orgs.map((org) => org.organizationId));
  const rows = (daily.data as DailyRow[] | null) ?? [];
  const events: ActivityEvent[] = rows
    .filter((row): row is DailyRow & { organization_id: string } => Boolean(row.organization_id) && kept.has(row.organization_id ?? ""))
    .filter((row) => row.kind !== "visit")
    .map((row) => ({
      organizationId: row.organization_id,
      at: `${row.day}T12:00:00+09:00`,
      kind: row.kind as ActivityEvent["kind"],
      n: row.n,
    }));
  const visits = rows.filter((row) => row.kind === "visit").map((row) => ({ day: row.day, n: row.n }));
  return { ok: true, orgs, events, visits, excluded: all.length - orgs.length };
}
