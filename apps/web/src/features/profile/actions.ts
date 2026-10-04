"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/authz-guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeDisplayName } from "@/features/profile/display-name";

export async function updateDisplayNameAction(
  _prev: { error?: string; ok?: true } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: true } | null> {
  const workspace = await requireWorkspace();
  const raw = formData.get("displayName");
  const name = normalizeDisplayName(typeof raw === "string" ? raw : "");
  if (!name) {
    return { error: "お名前を入力してください。" };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", workspace.userId);
  if (error) {
    return { error: "お名前を保存できませんでした。もう一度お試しください。" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
