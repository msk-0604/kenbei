import { NextResponse } from "next/server";
import { emptyUtmAttribution, isVisitorId, type UtmAttribution } from "@/features/sales/attribution";
import { insertFunnelEvent, type FunnelAdmin } from "@/features/sales/funnel-store";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function asUtm(value: unknown): UtmAttribution {
  if (!value || typeof value !== "object") {
    return emptyUtmAttribution();
  }
  const row = value as Record<string, unknown>;
  return {
    source: String(row.source ?? ""),
    medium: String(row.medium ?? ""),
    campaign: String(row.campaign ?? ""),
    content: String(row.content ?? ""),
    term: String(row.term ?? ""),
    landingPath: String(row.landingPath ?? "/"),
  };
}

export async function POST(request: Request) {
  let body: { visitorId?: unknown; utm?: unknown };
  try {
    body = (await request.json()) as { visitorId?: unknown; utm?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
  if (!isVisitorId(visitorId)) {
    return NextResponse.json({ error: "invalid visitor" }, { status: 400 });
  }
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return NextResponse.json({ ok: true, skipped: "not_configured" });
  }
  const result = await insertFunnelEvent(admin as unknown as FunnelAdmin, {
    visitorId,
    kind: "visit",
    utm: asUtm(body.utm),
  });
  if (result === "error") {
    return NextResponse.json({ ok: true, skipped: "error" });
  }
  return NextResponse.json({ ok: true, result });
}
