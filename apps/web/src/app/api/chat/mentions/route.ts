import { NextResponse } from "next/server";
import { notifyChatMentions } from "@/features/chat/queries";
import { getWorkspace } from "@/lib/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const workspace = await getWorkspace();
  if (!workspace?.organizationId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const payload = (await request.json().catch(() => null)) as { projectId?: string; body?: string } | null;
  if (!payload?.projectId || !payload.body) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const supabase = await createServerSupabaseClient();
  const project = await supabase
    .from("projects")
    .select("id")
    .eq("id", payload.projectId)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  if (!project.data) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  await notifyChatMentions(workspace, payload.projectId, payload.body);
  return NextResponse.json({ ok: true });
}
