import { PageHeader } from "@/components/ui/page-header";
import { NewSiteWithTodoForm } from "@/features/sites/new-site-with-todo";
import { getProgressPresets } from "@/features/sites/queries";
import { requireSiteAdmin } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function NewSitePage() {
  const workspace = await requireSiteAdmin();
  const presets = await getProgressPresets();
  return (
    <>
      <PageHeader
        title="新しい現場を登録"
        description="現場情報の登録と、作業工程の作成"
        backHref="/sites"
        backLabel="現場一覧に戻る"
      />
      <NewSiteWithTodoForm organizationId={workspace.organizationId} presets={presets.items} />
    </>
  );
}
