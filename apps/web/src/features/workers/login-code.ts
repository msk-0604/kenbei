import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * 作業員が合言葉で入るときの会社コード。作業員の合言葉が今あるときだけ返す
 * （合言葉ログインをやめても会社コードは残るので、案内に合言葉の入り方を出さないようにする）。
 */
export async function organizationLoginCode(organizationId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return null;
  }
  const [{ data }, passcodes] = await Promise.all([
    admin.from("organizations").select("login_code").eq("id", organizationId).maybeSingle(),
    admin
      .from("organization_passcodes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("kind", "worker"),
  ]);
  if ((passcodes.count ?? 0) === 0) {
    return null;
  }
  return (data as { login_code: string | null } | null)?.login_code ?? null;
}
