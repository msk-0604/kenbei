import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { requestExportAction } from "@/features/export/actions";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function ExportButton({ enabled }: { enabled: boolean }) {
  return (
    <form action={requestExportAction}>
      <button type="submit" disabled={!enabled} className="rounded-2xl bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50">
        エクスポートを開始
      </button>
    </form>
  );
}

export default async function DataExportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const workspace = await requireWorkspace();
  const params = await searchParams;
  if (!can(workspace, "org.manage")) {
    return (
      <AppShell>
        <h1 className="text-3xl font-semibold">データ</h1>
        <p className="mt-3">管理者のみがエクスポートできます。</p>
      </AppShell>
    );
  }
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("export_jobs")
    .select("id, status, created_at, expires_at, result_storage_path, error_message")
    .eq("organization_id", workspace.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);
  const jobs =
    (data as {
      id: string;
      status: string;
      created_at: string;
      expires_at: string | null;
      result_storage_path: string | null;
      error_message: string | null;
    }[] | null) ?? [];

  const requestDate = (await headers()).get("date");
  const nowIso = requestDate ? new Date(requestDate).toISOString() : null;
  const withUrls = await Promise.all(
    jobs.map(async (job) => {
      let url: string | null = null;
      if (job.status === "completed" && job.result_storage_path) {
        if (nowIso && job.expires_at && job.expires_at < nowIso) {
          return { ...job, status: "expired", url: null };
        }
        const signed = await supabase.storage.from("org-files").createSignedUrl(job.result_storage_path, 60 * 30);
        url = signed.data?.signedUrl ?? null;
      }
      return { ...job, url };
    }),
  );

  return (
    <AppShell>
      <p className="text-sm text-zinc-500">
        <a href="/settings">会社設定</a>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">データエクスポート</h1>
      <p className="mt-2 text-zinc-600">この会社のデータだけを JSON / CSV 入り ZIP で受け取れます。他社データは混ざりません。</p>
      {!isServiceRoleConfigured() ? (
        <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
          サーバーに SUPABASE_SERVICE_ROLE_KEY が無いため、エクスポートは実行できません。
        </p>
      ) : null}
      {params.error ? <p className="mt-4 text-sm text-red-600">{params.error}</p> : null}
      <div className="mt-6">
        <ExportButton enabled={isServiceRoleConfigured()} />
      </div>
      <ul className="mt-8 flex flex-col gap-2">
        {withUrls.map((job) => (
          <li key={job.id} className="rounded-2xl bg-white p-4 ring-1 ring-zinc-100">
            <p className="font-medium">{job.status}</p>
            <p className="text-sm text-zinc-500">{job.created_at}</p>
            {job.error_message ? <p className="text-sm text-red-600">{job.error_message}</p> : null}
            {job.url ? (
              <a href={job.url} className="mt-2 inline-flex text-sm underline">
                ZIPをダウンロード（期限付き）
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
