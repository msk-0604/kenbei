import type { UtmAttribution } from "./attribution";
import { isMissingSalesTable } from "./missing-table";

export type FunnelAdmin = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { code?: string; message?: string } | null }>;
  };
};

export type FunnelEventKind = "visit" | "trial_started" | "paid";

export async function insertFunnelEvent(
  admin: FunnelAdmin,
  input: {
    visitorId: string;
    organizationId?: string | null;
    kind: FunnelEventKind;
    utm?: UtmAttribution | null;
    planCode?: string | null;
  },
): Promise<"ok" | "duplicate" | "missing" | "error"> {
  const result = await admin.from("sales_funnel_events").insert({
    visitor_id: input.visitorId,
    organization_id: input.organizationId ?? null,
    event_kind: input.kind,
    utm_source: input.utm?.source || null,
    utm_medium: input.utm?.medium || null,
    utm_campaign: input.utm?.campaign || null,
    utm_content: input.utm?.content || null,
    utm_term: input.utm?.term || null,
    landing_path: input.utm?.landingPath || null,
    plan_code: input.planCode ?? null,
  });
  if (!result.error) {
    return "ok";
  }
  if (isMissingSalesTable(result.error)) {
    return "missing";
  }
  if (result.error.code === "23505") {
    return "duplicate";
  }
  return "error";
}
