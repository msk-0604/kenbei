import { PageHeader } from "@/components/ui/page-header";
import { HintBox } from "@/components/ui/hint-box";
import { PresetEditor } from "@/features/sites/preset-editor";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireSiteAdmin } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function PresetsPage() {
  const workspace = await requireSiteAdmin();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("progress_item_presets")
    .select("id, category, section, item_name")
    .eq("organization_id", workspace.organizationId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <>
      <PageHeader
        title="よく使う工程の候補"
        description="作業工程の「よく使う項目を追加する」に出る候補です"
        backHref="/kanri"
        backLabel="管理に戻る"
      />
      <HintBox>会社の業種に合わせて作り直せます。変えても、すでに現場に入っている工程はそのまま残ります。</HintBox>
      <PresetEditor
        organizationId={workspace.organizationId}
        initial={(data as { id: string; category: string; section: string | null; item_name: string }[] | null) ?? []}
      />
    </>
  );
}
