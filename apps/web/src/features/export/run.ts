import "server-only";

import { exportJobOrgSafe } from "@kensapo/domain";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { buildZip, toCsv } from "@/lib/zip";

async function scoped<T extends { organization_id: string }>(
  orgId: string,
  rows: T[] | null,
): Promise<T[]> {
  return (rows ?? []).filter((row) => exportJobOrgSafe(orgId, row.organization_id));
}

export async function processExportJob(jobId: string): Promise<{ error: string } | null> {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return { error: "SUPABASE_SERVICE_ROLE_KEY が未設定です。エクスポートできません。" };
  }
  const jobRow = await admin.from("export_jobs").select("*").eq("id", jobId).maybeSingle();
  const job = jobRow.data as {
    id: string;
    organization_id: string;
    status: string;
    requested_by: string;
  } | null;
  if (!job || job.status !== "queued") {
    return null;
  }
  await admin
    .from("export_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("organization_id", job.organization_id);

  try {
    const orgId = job.organization_id;
    const [projects, sites, photos, documents, reports, tasks, processes, chat, members, fields] =
      await Promise.all([
        admin.from("projects").select("*").eq("organization_id", orgId).is("deleted_at", null),
        admin.from("project_sites").select("*").eq("organization_id", orgId).is("deleted_at", null),
        admin.from("photos").select("id, organization_id, project_id, taken_at, storage_path, comment").eq("organization_id", orgId).is("deleted_at", null),
        admin.from("documents").select("id, organization_id, project_id, title, category, version, is_latest, storage_path").eq("organization_id", orgId).is("deleted_at", null),
        admin.from("daily_reports").select("*").eq("organization_id", orgId).is("deleted_at", null),
        admin.from("project_tasks").select("*").eq("organization_id", orgId).is("deleted_at", null),
        admin.from("processes").select("*").eq("organization_id", orgId).is("deleted_at", null),
        admin.from("project_messages").select("*").eq("organization_id", orgId),
        admin.from("memberships").select("id, organization_id, profile_id, status, role_id").eq("organization_id", orgId).is("deleted_at", null),
        admin.from("capture_fields").select("id, organization_id, project_id, field_key, status, proposed_value_json, confirmed_value_json").eq("organization_id", orgId).is("deleted_at", null),
      ]);

    const bundle = {
      organization_id: orgId,
      exported_at: new Date().toISOString(),
      projects: await scoped(orgId, projects.data as { organization_id: string }[] | null),
      sites: await scoped(orgId, sites.data as { organization_id: string }[] | null),
      photos: await scoped(orgId, photos.data as { organization_id: string }[] | null),
      documents: await scoped(orgId, documents.data as { organization_id: string }[] | null),
      drawings: await scoped(
        orgId,
        ((documents.data as { organization_id: string; category?: string }[] | null) ?? []).filter(
          (row) => row.category === "drawing",
        ),
      ),
      reports: await scoped(orgId, reports.data as { organization_id: string }[] | null),
      tasks: await scoped(orgId, tasks.data as { organization_id: string }[] | null),
      processes: await scoped(orgId, processes.data as { organization_id: string }[] | null),
      chat: await scoped(orgId, chat.data as { organization_id: string }[] | null),
      confirm: await scoped(orgId, fields.data as { organization_id: string }[] | null),
      members: await scoped(orgId, members.data as { organization_id: string }[] | null),
      metadata: { requested_by: job.requested_by },
    };

    const files = [
      { name: "export.json", content: JSON.stringify(bundle, null, 2) },
      { name: "projects.csv", content: toCsv(bundle.projects) },
      { name: "photos.csv", content: toCsv(bundle.photos) },
      { name: "documents.csv", content: toCsv(bundle.documents) },
      { name: "reports.csv", content: toCsv(bundle.reports) },
      { name: "tasks.csv", content: toCsv(bundle.tasks) },
      { name: "processes.csv", content: toCsv(bundle.processes) },
      { name: "chat.csv", content: toCsv(bundle.chat) },
      { name: "members.csv", content: toCsv(bundle.members) },
    ];
    const zip = buildZip(files);
    const path = `${orgId}/exports/${job.id}.zip`;
    const upload = await admin.storage.from("org-files").upload(path, zip, {
      contentType: "application/zip",
      upsert: true,
    });
    if (upload.error) {
      throw new Error(upload.error.message);
    }
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await admin
      .from("export_jobs")
      .update({
        status: "completed",
        format: "zip",
        result_storage_path: path,
        result_bytes: zip.byteLength,
        completed_at: new Date().toISOString(),
        expires_at: expires,
      })
      .eq("id", job.id)
      .eq("organization_id", orgId);
  } catch (error) {
    await admin
      .from("export_jobs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "export failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("organization_id", job.organization_id);
    return { error: error instanceof Error ? error.message : "export failed" };
  }
  return null;
}
