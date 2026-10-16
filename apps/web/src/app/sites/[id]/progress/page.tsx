import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { HintBox } from "@/components/ui/hint-box";
import { ProgressChecklist } from "@/features/sites/progress-checklist";
import { getMemberNames, getProgressItems, getProgressPresets, getSite } from "@/features/sites/queries";
import { PRINTED_FORM_NOTES } from "@/lib/standard-progress-items";
import { can, isCrewLogin, isSiteAdmin, requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function SiteProgressPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ work?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const workspace = await requireWorkspace();
  const site = await getSite(id);
  if (!site) {
    notFound();
  }
  const [items, presets, namesById] = await Promise.all([
    getProgressItems(id).catch(() => []),
    getProgressPresets(),
    getMemberNames(),
  ]);
  const isAdmin = isSiteAdmin(workspace);
  const canRecord = can(workspace, "capture.confirm") || can(workspace, "project.update");

  return (
    <>
      <PageHeader title="工事の進捗" description={site.name} backHref={`/sites/${id}`} backLabel="現場に戻る" />

      <HintBox>
        左が項目、右が結果です。未確認のまま、未完了、完了を押し分けてください。
        {presets.custom
          ? null
          : PRINTED_FORM_NOTES.map((note) => (
              <span key={note} className="mt-2 block">
                {note}
              </span>
            ))}
      </HintBox>

      <ProgressChecklist
        items={items}
        projectId={id}
        organizationId={workspace.organizationId}
        presets={presets.items}
        canManageItems={canRecord}
        canCompleteSite={isAdmin}
        notifyOnItemAdd
        actorName={isCrewLogin(workspace) ? "" : workspace.displayName}
        namesById={namesById}
        todayWork={query.work ?? ""}
        siteStatus={site.status}
      />
    </>
  );
}
