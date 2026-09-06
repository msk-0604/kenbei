"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { getAppUrl } from "@/lib/env";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requestExportAction(): Promise<void> {
  const result = await enqueueExport();
  if (result?.error) {
    redirect(`/settings/data?error=${encodeURIComponent(result.error)}`);
  }
}

async function enqueueExport(): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "org.manage")) {
    return { error: "エクスポートできるのは管理者のみです。" };
  }
  if (!isServiceRoleConfigured()) {
    return {
      error:
        "サーバーに SUPABASE_SERVICE_ROLE_KEY が未設定のため、エクスポートを開始できません。管理者に設定を依頼してください。",
    };
  }
  const supabase = await createServerSupabaseClient();
  const inserted = await supabase
    .from("export_jobs")
    .insert({
      organization_id: workspace.organizationId,
      requested_by: workspace.userId,
      status: "queued",
      format: "zip",
    })
    .select("id")
    .maybeSingle();
  if (inserted.error || !inserted.data) {
    return { error: inserted.error?.message ?? "ジョブを作れませんでした。" };
  }
  const jobId = (inserted.data as { id: string }).id;
  const run = await fetch(`${getAppUrl()}/api/export/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-export-job": jobId },
    body: JSON.stringify({ jobId, organizationId: workspace.organizationId }),
  }).catch(() => null);
  if (!run || !run.ok) {
    const message =
      (run ? ((await run.json().catch(() => null)) as { error?: string } | null)?.error : null) ??
      "エクスポート処理を開始できませんでした。";
    await supabase
      .from("export_jobs")
      .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("organization_id", workspace.organizationId);
    return { error: message };
  }
  revalidatePath("/settings/data");
  return null;
}
