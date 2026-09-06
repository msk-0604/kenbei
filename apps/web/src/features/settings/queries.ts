import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CompanySettings = {
  companyDisplayName: string | null;
  logoStoragePath: string | null;
  logoUrl: string | null;
  organizationName: string;
};

export async function getCompanySettings(organizationId: string): Promise<CompanySettings> {
  const supabase = await createServerSupabaseClient();
  const org = await supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle();
  const settings = await supabase
    .from("organization_settings")
    .select("company_display_name, logo_storage_path")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const orgRow = org.data as { name: string } | null;
  const settingsRow = settings.data as {
    company_display_name: string | null;
    logo_storage_path: string | null;
  } | null;
  let logoUrl: string | null = null;
  if (settingsRow?.logo_storage_path) {
    const signed = await supabase.storage
      .from("org-files")
      .createSignedUrl(settingsRow.logo_storage_path, 60 * 60);
    logoUrl = signed.data?.signedUrl ?? null;
  }
  return {
    companyDisplayName: settingsRow?.company_display_name ?? null,
    logoStoragePath: settingsRow?.logo_storage_path ?? null,
    logoUrl,
    organizationName: orgRow?.name ?? "",
  };
}

export type InviteRow = {
  id: string;
  email: string;
  expiresAt: string;
  acceptedAt: string | null;
  roleName: string;
  token: string;
};

export async function listInvites(): Promise<InviteRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("organization_invitations")
    .select("id, email, expires_at, accepted_at, token, roles(name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    throw new Error(error.message);
  }
  type Row = {
    id: string;
    email: string;
    expires_at: string;
    accepted_at: string | null;
    token: string;
    roles: { name: string } | { name: string }[] | null;
  };
  const one = <T,>(value: T | T[] | null): T | null =>
    !value ? null : Array.isArray(value) ? (value[0] ?? null) : value;
  return ((data as Row[] | null) ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    token: row.token,
    roleName: one(row.roles)?.name ?? "",
  }));
}
