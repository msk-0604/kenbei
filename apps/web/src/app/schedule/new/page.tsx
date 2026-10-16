import { PageHeader } from "@/components/ui/page-header";
import { ScheduleForm } from "@/features/schedules/schedule-form";
import { listSites, listWorkers, toSiteOptions } from "@/features/sites/queries";
import { requireSiteAdmin } from "@/lib/authz-guard";
import { clampDateISO } from "@/lib/site-dates";

export const dynamic = "force-dynamic";

export default async function ScheduleNewPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const workspace = await requireSiteAdmin();
  const params = await searchParams;
  const [workers, sites] = await Promise.all([listWorkers(), listSites()]);

  return (
    <>
      <PageHeader title="予定を追加" description="作業予定を登録します" backHref="/schedule" backLabel="予定一覧に戻る" />
      <ScheduleForm
        organizationId={workspace.organizationId}
        workers={workers}
        projects={toSiteOptions(sites)}
        defaultDate={clampDateISO(params.date)}
      />
    </>
  );
}
