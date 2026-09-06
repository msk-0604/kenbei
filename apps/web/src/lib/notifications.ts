import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendExpoPushToMember } from "@/lib/push";
import type { Workspace } from "@/lib/session";
import type { SupabaseClient } from "@supabase/supabase-js";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function listMemberProfileIdsWithPermission(
  supabase: SupabaseClient,
  organizationId: string,
  permission: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("memberships")
    .select("profile_id, roles(role_permissions(permission_code))")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("deleted_at", null);
  const ids = new Set<string>();
  for (const row of (data as
    | {
        profile_id: string;
        roles:
          | { role_permissions: { permission_code: string }[] | { permission_code: string } | null }
          | { role_permissions: { permission_code: string }[] | { permission_code: string } | null }[]
          | null;
      }[]
    | null) ?? []) {
    const role = one(row.roles);
    const perms = role?.role_permissions;
    const list = Array.isArray(perms) ? perms : perms ? [perms] : [];
    if (list.some((item) => item.permission_code === permission)) {
      ids.add(row.profile_id);
    }
  }
  return [...ids];
}

export async function profileIdForMembership(
  supabase: SupabaseClient,
  organizationId: string,
  membershipId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("memberships")
    .select("profile_id")
    .eq("id", membershipId)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  return (data as { profile_id: string } | null)?.profile_id ?? null;
}

export async function notifyWorkspaceMembers(
  workspace: Workspace,
  input: {
    projectId?: string;
    kind: string;
    title: string;
    body?: string;
    href?: string;
    profileIds?: string[];
    extra?: Record<string, string>;
  },
): Promise<void> {
  if (!workspace.organizationId) {
    return;
  }
  const supabase = await createServerSupabaseClient();
  const requested = input.profileIds ?? [workspace.userId];
  const unique = [...new Set(requested.filter(Boolean))];
  if (unique.length === 0) {
    return;
  }
  const { data: members } = await supabase
    .from("memberships")
    .select("profile_id")
    .eq("organization_id", workspace.organizationId)
    .eq("status", "active")
    .is("deleted_at", null)
    .in("profile_id", unique);
  const allowed = new Set(
    ((members as { profile_id: string }[] | null) ?? []).map((row) => row.profile_id),
  );

  for (const profileId of unique) {
    if (!allowed.has(profileId)) {
      continue;
    }
    const { error } = await supabase.rpc("create_notification_for_member", {
      p_organization_id: workspace.organizationId,
      p_profile_id: profileId,
      p_project_id: input.projectId ?? null,
      p_kind: input.kind,
      p_title: input.title,
      p_body: input.body ?? null,
      p_href: input.href ?? null,
    });
    if (error) {
      continue;
    }
    await sendExpoPushToMember({
      organizationId: workspace.organizationId,
      profileId,
      title: input.title,
      body: input.body,
      data: {
        kind: input.kind,
        href: input.href ?? "",
        projectId: input.projectId ?? "",
        ...input.extra,
      },
    });
  }
}

export async function listUnreadNotifications(workspace: Workspace) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, href, kind, created_at, read_at")
    .eq("profile_id", workspace.userId)
    .eq("organization_id", workspace.organizationId)
    .is("deleted_at", null)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    throw new Error(error.message);
  }
  return (data as
    | {
        id: string;
        title: string;
        body: string | null;
        href: string | null;
        kind: string;
        created_at: string;
        read_at: string | null;
      }[]
    | null) ?? [];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null);
}
