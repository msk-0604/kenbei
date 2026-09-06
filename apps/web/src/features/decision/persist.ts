import "server-only";

import type { Signal } from "@kensapo/decision-engine";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function persistOpsSignals(organizationId: string, signals: Signal[]): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const open = await supabase
    .from("ops_signals")
    .select("id, signal_type, ref_id")
    .eq("organization_id", organizationId)
    .is("resolved_at", null);
  const rows =
    (open.data as { id: string; signal_type: string; ref_id: string | null }[] | null) ?? [];
  const current = new Set(signals.map((item) => item.id));
  const now = new Date().toISOString();
  for (const row of rows) {
    const key = `${row.signal_type}:${row.ref_id ?? ""}`;
    if (!current.has(key)) {
      await supabase
        .from("ops_signals")
        .update({ resolved_at: now })
        .eq("id", row.id)
        .eq("organization_id", organizationId);
    }
  }
  const existing = new Set(rows.map((row) => `${row.signal_type}:${row.ref_id ?? ""}`));
  for (const item of signals) {
    if (existing.has(item.id)) {
      continue;
    }
    const refId = item.id.includes(":") ? item.id.slice(item.id.indexOf(":") + 1) : item.id;
    await supabase.from("ops_signals").insert({
      organization_id: organizationId,
      project_id: item.projectId || null,
      signal_type: item.code,
      severity: item.severity,
      title: item.title,
      reason: String(item.evidence.reason ?? item.title),
      source: item.detector,
      ref_id: refId,
    });
  }
}
