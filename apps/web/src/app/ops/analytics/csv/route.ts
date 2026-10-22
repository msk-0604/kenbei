import { NextResponse } from "next/server";
import { orgFactsCsv } from "@/features/ops/analytics";
import { loadOpsAnalytics } from "@/features/ops/analytics-queries";
import { isPlatformAdminEmail } from "@/features/ops/org-health";
import { readServerEnv } from "@/lib/server-env";
import { getWorkspace } from "@/lib/session";

export const dynamic = "force-dynamic";

/** 運営用：会社ごとの使い始めの状況を CSV で（スプレッドシートで分析する） */
export async function GET() {
  const workspace = await getWorkspace();
  const adminEmails = readServerEnv("PLATFORM_ADMIN_EMAILS");
  if (!workspace || !isPlatformAdminEmail(workspace.email, adminEmails)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const data = await loadOpsAnalytics(adminEmails);
  if (!data.ok) {
    return NextResponse.json({ error: data.reason }, { status: 503 });
  }
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(orgFactsCsv(data.orgs), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kenbei-orgs-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
