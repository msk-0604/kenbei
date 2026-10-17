"use server";

import { redirect } from "next/navigation";
import { afterOrganizationCreated } from "@/features/sales/after-org-create";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeDisplayName } from "@/features/profile/display-name";
import { tradeTemplate } from "@/lib/trade-progress-templates";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createOrganizationAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const name = formString(formData, "name");
  if (!name) {
    return { error: "会社名を入力してください。" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const displayName = normalizeDisplayName(formString(formData, "displayName"));
  if (displayName) {
    await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
  }

  const { data: organizationId, error } = await supabase.rpc("create_organization", { p_name: name });
  if (error) {
    return { error: error.message };
  }
  if (typeof organizationId === "string") {
    await afterOrganizationCreated({ organizationId, email: user.email });
    // 水道・管工事は標準の候補をそのまま使う。ほかの業種は、その業種の工程を会社の候補に入れておく。
    const trade = tradeTemplate(formString(formData, "trade"));
    if (trade && trade.key !== "plumbing") {
      await supabase.from("progress_item_presets").insert(
        trade.items.map((item, index) => ({
          organization_id: organizationId,
          category: item.category,
          section: item.section,
          item_name: item.item_name,
          sort_order: index,
        })),
      );
    }
  }

  // 最初は管理画面の「はじめにやること」から
  redirect("/kanri");
}
