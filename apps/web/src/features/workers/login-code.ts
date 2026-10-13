import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function organizationLoginCode(organizationId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return null;
  }
  const { data } = await admin.from("organizations").select("login_code").eq("id", organizationId).maybeSingle();
  return (data as { login_code: string | null } | null)?.login_code ?? null;
}
