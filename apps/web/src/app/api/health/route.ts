import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 死活監視（UptimeRobot など）が1〜5分ごとに叩く。
 * アプリと DB の両方が応答していれば 200、DB に届かなければ 503。中身の情報は返さない。
 */
export async function GET() {
  const started = Date.now();
  const admin = createAdminSupabaseClient();
  let db: "ok" | "down" | "unconfigured" = "unconfigured";
  if (admin) {
    try {
      const { error } = await admin.from("billing_plans").select("code", { count: "exact", head: true });
      db = error ? "down" : "ok";
    } catch {
      db = "down";
    }
  }
  const ok = db === "ok";
  return NextResponse.json(
    { ok, db, ms: Date.now() - started },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
