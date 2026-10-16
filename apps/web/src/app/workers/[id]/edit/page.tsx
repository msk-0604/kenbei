import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { WorkerForm } from "@/features/workers/worker-form";
import { getWorker } from "@/features/sites/queries";
import { requireSiteAdmin } from "@/lib/authz-guard";
import { workerMemberOptions } from "@/features/workers/member-options";

export const dynamic = "force-dynamic";

export default async function EditWorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireSiteAdmin();
  const [worker, members] = await Promise.all([getWorker(id), workerMemberOptions()]);
  if (!worker) {
    notFound();
  }
  return (
    <>
      <PageHeader
        title="作業員の情報を変更"
        description="名前・電話番号・アカウントの紐づけを修正できます"
        backHref="/workers"
        backLabel="作業員一覧に戻る"
      />
      <WorkerForm worker={worker} organizationId={workspace.organizationId} loginCode={null} members={members} />
    </>
  );
}
