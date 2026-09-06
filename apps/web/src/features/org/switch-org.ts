"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireWorkspace } from "@/lib/authz-guard";
import { ORG_COOKIE } from "@/lib/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function switchOrganizationAction(organizationId: string): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  const allowed = workspace.organizations.some((item) => item.organizationId === organizationId);
  if (!allowed) {
    return { error: "その会社には参加していません。" };
  }
  const jar = await cookies();
  jar.set(ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  const supabase = await createServerSupabaseClient();
  await supabase.from("profiles").update({ preferred_organization_id: organizationId }).eq("id", workspace.userId);
  revalidatePath("/", "layout");
  return null;
}
