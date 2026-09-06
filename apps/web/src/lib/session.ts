import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import type { PermissionCode } from "@kensapo/domain";
import { isPermissionCode } from "@kensapo/domain";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const ORG_COOKIE = "kb_org";

export type WorkspaceOrg = {
  organizationId: string;
  organizationName: string;
  membershipId: string;
  roleCode: string;
  roleName: string;
};

export type Workspace = {
  userId: string;
  email: string | undefined;
  displayName: string;
  organizationId: string;
  organizationName: string;
  membershipId: string;
  roleCode: string;
  roleName: string;
  permissions: PermissionCode[];
  organizations: WorkspaceOrg[];
};

type MembershipRow = {
  id: string;
  organization_id: string;
  organizations: { name: string } | { name: string }[] | null;
  roles: {
    code: string;
    name: string;
    role_permissions: { permission_code: string }[] | null;
  } | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function emptyWorkspace(
  userId: string,
  email: string | undefined,
  displayName: string,
): Workspace {
  return {
    userId,
    email,
    displayName,
    organizationId: "",
    organizationName: "",
    membershipId: "",
    roleCode: "",
    roleName: "",
    permissions: [],
    organizations: [],
  };
}

export const getWorkspace = cache(async (): Promise<Workspace | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("display_name, preferred_organization_id")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileRow as { display_name: string; preferred_organization_id: string | null } | null;
  const displayName = profile?.display_name ?? user.email ?? "ユーザー";

  const { data: memberships } = await supabase
    .from("memberships")
    .select(
      "id, organization_id, organizations(name), roles(code, name, role_permissions(permission_code))",
    )
    .eq("profile_id", user.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const rows = (memberships as MembershipRow[] | null) ?? [];
  if (rows.length === 0) {
    return emptyWorkspace(user.id, user.email, displayName);
  }

  const organizations: WorkspaceOrg[] = rows.map((row) => {
    const org = one(row.organizations);
    const role = row.roles;
    return {
      organizationId: row.organization_id,
      organizationName: org?.name ?? "",
      membershipId: row.id,
      roleCode: role?.code ?? "",
      roleName: role?.name ?? "",
    };
  });

  const cookieStore = await cookies();
  const requested =
    cookieStore.get(ORG_COOKIE)?.value || profile?.preferred_organization_id || organizations[0]?.organizationId;
  const selected =
    organizations.find((item) => item.organizationId === requested) ?? organizations[0];
  if (!selected) {
    return emptyWorkspace(user.id, user.email, displayName);
  }

  const row = rows.find((item) => item.organization_id === selected.organizationId) ?? rows[0];
  if (!row) {
    return emptyWorkspace(user.id, user.email, displayName);
  }
  const permissions = (row.roles?.role_permissions ?? [])
    .map((item) => item.permission_code)
    .filter(isPermissionCode);

  return {
    userId: user.id,
    email: user.email,
    displayName,
    organizationId: selected.organizationId,
    organizationName: selected.organizationName,
    membershipId: selected.membershipId,
    roleCode: selected.roleCode,
    roleName: selected.roleName,
    permissions,
    organizations,
  };
});

export function hasOrganization(workspace: Workspace | null): boolean {
  return Boolean(workspace?.organizationId);
}
