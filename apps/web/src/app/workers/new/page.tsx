import { PageHeader } from "@/components/ui/page-header";
import { WorkerForm } from "@/features/workers/worker-form";
import { requireSiteAdmin } from "@/lib/authz-guard";
import { workerMemberOptions } from "@/features/workers/member-options";
import { organizationLoginCode } from "@/features/workers/login-code";

export const dynamic = "force-dynamic";

export default async function NewWorkerPage() {
  const workspace = await requireSiteAdmin();
  const [members, loginCode] = await Promise.all([
    workerMemberOptions(),
    organizationLoginCode(workspace.organizationId),
  ]);
  return (
    <>
      <PageHeader
        title="作業員を登録"
        description="現場に割り当てる作業員の情報を入力してください"
        backHref="/workers"
        backLabel="作業員一覧に戻る"
      />
      <WorkerForm organizationId={workspace.organizationId} loginCode={loginCode} members={members} />
    </>
  );
}
