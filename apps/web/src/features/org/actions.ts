"use server";

import { redirect } from "next/navigation";
import { afterOrganizationCreated } from "@/features/sales/after-org-create";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeDisplayName } from "@/features/profile/display-name";

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
  }

  redirect("/");
}
