"use server";

import { revalidatePath } from "next/cache";
import { assertOrganizationWritable, isSiteAdmin, requireWorkspace } from "@/lib/authz-guard";
import { consumeRateLimit, RATE_LIMIT_UNAVAILABLE_MESSAGE } from "@/lib/rate-limit";
import { oneOffScheduleDates } from "@/lib/site-rules";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { readSiteRows, readWorkerRows } from "@/features/import/csv-import";
import type { Workspace } from "@/lib/session";

export type ImportActionResult =
  | { ok: true; created: number; skipped: string[] }
  | { ok: false; error: string };

async function requireImporter(): Promise<Workspace | { error: string }> {
  const workspace = await requireWorkspace();
  if (!isSiteAdmin(workspace)) {
    return { error: "取り込みは管理者だけができます" };
  }
  const locked = await assertOrganizationWritable(workspace.organizationId);
  if (locked) {
    return locked;
  }
  const limit = await consumeRateLimit(`import:${workspace.userId}`, 10, 60_000);
  if (!limit.allowed) {
    return { error: limit.reason === "unavailable" ? RATE_LIMIT_UNAVAILABLE_MESSAGE : "取り込みが多すぎます。少し待ってからやり直してください。" };
  }
  return workspace;
}

function isTable(value: unknown): value is string[][] {
  return Array.isArray(value) && value.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "string"));
}

/** 作業員名簿の取り込み。同じ名前の作業員がすでにいれば飛ばす。 */
export async function importWorkersAction(table: unknown): Promise<ImportActionResult> {
  const workspace = await requireImporter();
  if ("error" in workspace) {
    return { ok: false, error: workspace.error };
  }
  if (!isTable(table)) {
    return { ok: false, error: "ファイルを読めませんでした" };
  }
  const parsed = readWorkerRows(table);
  if (parsed.missingHeaders.length > 0) {
    return { ok: false, error: `見出しに「${parsed.missingHeaders.join("」「")}」がありません` };
  }
  const supabase = await createServerSupabaseClient();
  const existing = await supabase
    .from("workers")
    .select("name")
    .eq("organization_id", workspace.organizationId);
  const have = new Set(((existing.data as { name: string }[] | null) ?? []).map((row) => row.name));
  const fresh = parsed.rows.filter((row) => !have.has(row.name));
  const skipped = parsed.rows.filter((row) => have.has(row.name)).map((row) => row.name);
  if (fresh.length > 0) {
    const { error } = await supabase.from("workers").insert(
      fresh.map((row) => ({
        organization_id: workspace.organizationId,
        name: row.name,
        phone: row.phone,
        trade: row.trade,
        status: "active",
      })),
    );
    if (error) {
      return { ok: false, error: "作業員の登録に失敗しました。もう一度お試しください。" };
    }
  }
  revalidatePath("/workers");
  revalidatePath("/kanri");
  return { ok: true, created: fresh.length, skipped };
}

/**
 * 現場の取り込み。同じ名前の現場がすでにあれば飛ばす。
 * 画面から1件ずつ登録したときと同じく、単発の現場は着工日〜完了予定日の予定を作る。お知らせは送らない。
 */
export async function importSitesAction(table: unknown): Promise<ImportActionResult> {
  const workspace = await requireImporter();
  if ("error" in workspace) {
    return { ok: false, error: workspace.error };
  }
  if (!isTable(table)) {
    return { ok: false, error: "ファイルを読めませんでした" };
  }
  const parsed = readSiteRows(table);
  if (parsed.missingHeaders.length > 0) {
    return { ok: false, error: `見出しに「${parsed.missingHeaders.join("」「")}」がありません` };
  }
  const supabase = await createServerSupabaseClient();
  const org = workspace.organizationId;

  const existing = await supabase.from("projects").select("name").eq("organization_id", org).is("deleted_at", null);
  const have = new Set(((existing.data as { name: string }[] | null) ?? []).map((row) => row.name));
  const fresh = parsed.rows.filter((row) => !have.has(row.name));
  const skipped = parsed.rows.filter((row) => have.has(row.name)).map((row) => row.name);
  if (fresh.length === 0) {
    return { ok: true, created: 0, skipped };
  }

  // お客様は名前で探し、なければ作る
  const customerNames = [...new Set(fresh.map((row) => row.customer_name).filter((name): name is string => Boolean(name)))];
  const customerIds = new Map<string, string>();
  if (customerNames.length > 0) {
    const found = await supabase
      .from("customers")
      .select("id, name")
      .eq("organization_id", org)
      .is("deleted_at", null)
      .in("name", customerNames);
    for (const row of (found.data as { id: string; name: string }[] | null) ?? []) {
      customerIds.set(row.name, row.id);
    }
    const missing = customerNames.filter((name) => !customerIds.has(name));
    if (missing.length > 0) {
      const inserted = await supabase
        .from("customers")
        .insert(missing.map((name) => ({ organization_id: org, name, created_by: workspace.userId, updated_by: workspace.userId })))
        .select("id, name");
      for (const row of (inserted.data as { id: string; name: string }[] | null) ?? []) {
        customerIds.set(row.name, row.id);
      }
    }
  }

  const inserted = await supabase
    .from("projects")
    .insert(
      fresh.map((row) => ({
        organization_id: org,
        name: row.name,
        status: "active",
        customer_id: row.customer_name ? (customerIds.get(row.customer_name) ?? null) : null,
        work_summary: row.work_type,
        planned_start_on: row.start_date,
        planned_end_on: row.end_date,
        manager_name: row.manager_name,
        prime_contractor_name: row.prime_contractor_name,
        memo: row.memo,
        work_duration: row.work_duration,
        source: "import",
        created_by: workspace.userId,
        updated_by: workspace.userId,
      })),
    )
    .select("id, name");
  const created = (inserted.data as { id: string; name: string }[] | null) ?? [];
  if (inserted.error || created.length === 0) {
    return { ok: false, error: "現場の登録に失敗しました。もう一度お試しください。" };
  }
  const byName = new Map(fresh.map((row) => [row.name, row]));

  const addresses = created.flatMap((site) => {
    const address = byName.get(site.name)?.address;
    return address
      ? [{ organization_id: org, project_id: site.id, address, is_primary: true, created_by: workspace.userId, updated_by: workspace.userId }]
      : [];
  });
  if (addresses.length > 0) {
    await supabase.from("project_sites").insert(addresses);
  }
  await supabase.from("project_members").insert(
    created.map((site) => ({
      organization_id: org,
      project_id: site.id,
      membership_id: workspace.membershipId,
      role_in_project: "supervisor",
      status: "active",
      created_by: workspace.userId,
      updated_by: workspace.userId,
    })),
  );
  const schedules = created.flatMap((site) => {
    const row = byName.get(site.name);
    if (!row) {
      return [];
    }
    return oneOffScheduleDates(row.work_duration, row.start_date, row.end_date).map((schedule_date) => ({
      organization_id: org,
      project_id: site.id,
      schedule_date,
      worker_id: null,
      status: "scheduled",
      time_kind: "unset",
      work_content: row.work_type,
    }));
  });
  if (schedules.length > 0) {
    await supabase.from("schedules").insert(schedules);
  }

  revalidatePath("/sites");
  revalidatePath("/today");
  revalidatePath("/kanri");
  return { ok: true, created: created.length, skipped };
}
