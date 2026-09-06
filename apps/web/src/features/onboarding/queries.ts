import "server-only";

import { onboardingComplete, type OnboardingFlags } from "@kensapo/domain";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/session";

export async function loadOnboardingFlags(workspace: Workspace): Promise<OnboardingFlags & { complete: boolean }> {
  const supabase = await createServerSupabaseClient();
  const orgId = workspace.organizationId;
  const [projects, members, invites, photos, tasks] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", orgId).is("deleted_at", null),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active").is("deleted_at", null),
    supabase.from("organization_invitations").select("id", { count: "exact", head: true }).eq("organization_id", orgId).is("deleted_at", null),
    supabase.from("photos").select("id", { count: "exact", head: true }).eq("organization_id", orgId).is("deleted_at", null),
    supabase.from("project_tasks").select("id", { count: "exact", head: true }).eq("organization_id", orgId).is("deleted_at", null),
  ]);
  const flags: OnboardingFlags = {
    hasOrganization: Boolean(orgId),
    hasProject: (projects.count ?? 0) > 0,
    hasInviteOrMember: (members.count ?? 0) > 1 || (invites.count ?? 0) > 0,
    hasPhoto: (photos.count ?? 0) > 0,
    hasTask: (tasks.count ?? 0) > 0,
  };
  return { ...flags, complete: onboardingComplete(flags) };
}
