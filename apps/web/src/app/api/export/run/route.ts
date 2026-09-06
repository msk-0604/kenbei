import { acceptOnlySessionOrganization } from "@kensapo/domain";
import { NextResponse } from "next/server";
import { processExportJob } from "@/features/export/run";
import { getWorkspace } from "@/lib/session";

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
  if (payload.organizationId && !acceptOnlySessionOrganization(workspace.organizationId, payload.organizationId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const result = await processExportJob(payload.jobId);
  if (result?.error) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
