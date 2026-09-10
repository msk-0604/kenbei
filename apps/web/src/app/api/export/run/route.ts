import { authorizeExportJobRun } from "@kensapo/domain";
import { NextResponse } from "next/server";
import { processExportJob } from "@/features/export/run";
import { getWorkspace } from "@/lib/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const workspace = await getWorkspace();
  const payload = (await request.json().catch(() => null)) as {
    jobId?: string;
    organizationId?: string;
  } | null;
  if (!workspace?.organizationId || !payload?.jobId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();
  const owned = await supabase
    .from("export_jobs")
    .select("id, organization_id")
    .eq("id", payload.jobId)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  const job = owned.data as { id: string; organization_id: string } | null;
  if (
    !job ||
    !authorizeExportJobRun({
      sessionOrganizationId: workspace.organizationId,
      jobOrganizationId: job.organization_id,
      claimedOrganizationId: payload.organizationId,
    })
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await processExportJob(job.id, workspace.organizationId);
  if (result?.code === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (result?.error) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
