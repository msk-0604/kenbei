import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SiteForm } from "@/features/sites/site-form";
import { getSite } from "@/features/sites/queries";
import { requireSiteAdmin } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSiteAdmin();
  const site = await getSite(id);
  if (!site) {
    notFound();
  }
  return (
    <>
      <PageHeader
        title="現場の情報を変更"
        description={`現場名：${site.name}`}
        backHref={`/sites/${id}`}
        backLabel="現場の画面に戻る"
      />
      <SiteForm project={site} />
    </>
  );
}
