import { revalidatePath } from "next/cache";
import {
  alreadyInCompanyMessage,
  inviteEmailMismatchMessage,
} from "@kensapo/domain";
import { getWorkspace } from "@/lib/session";
import { toUserActionError } from "@/lib/user-error";
import { listMemberProfileIdsWithPermission, notifyWorkspaceMembers } from "@/lib/notifications";
import type { Workspace } from "@/lib/session";
import { firstInvitePreview } from "@/features/settings/invite-preview";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function acceptInviteForCurrentUser(
  token: string,
): Promise<{ error: string } | { joined: string }> {
  const supabase = await createServerSupabaseClient();
  const preview = await supabase.rpc("preview_organization_invite", { p_token: token });
  const previewRow = firstInvitePreview(preview.data);
  const { error } = await supabase.rpc("accept_organization_invite", { p_token: token });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("KENBEI_SEAT_LIMIT")) {
      return { error: "人数の上限のため参加できません。管理者に連絡してください。" };
    }
    if (message.includes("KENBEI_ALREADY_IN_ORG")) {
      const workspace = await getWorkspace();
      return { error: alreadyInCompanyMessage(workspace?.organizationName || "今の会社") };
    }
    if (message.includes("invite email mismatch")) {
      return { error: inviteEmailMismatchMessage() };
    }
    if (message.includes("invite not found or expired")) {
      return { error: "招待リンクが無効か、すでに使われています。" };
    }
    return { error: toUserActionError(error.message, "会社に参加") };
  }
  const {
    data: { user: accepted },
  } = await supabase.auth.getUser();
  if (accepted) {
    const membership = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("profile_id", accepted.id)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const organizationId = (membership.data as { organization_id: string } | null)?.organization_id;
    if (organizationId) {
      const workspaceLike: Workspace = {
        userId: accepted.id,
        email: accepted.email,
        displayName: accepted.email ?? "",
        organizationId,
        organizationName: "",
        membershipId: "",
        roleCode: "",
        roleName: "",
        permissions: [],
        organizations: [],
      };
      await notifyWorkspaceMembers(workspaceLike, {
        kind: "invite",
        title: "会社への招待を承諾しました",
        href: "/",
        profileIds: [accepted.id],
      });
      const managers = await listMemberProfileIdsWithPermission(supabase, organizationId, "member.manage");
      await notifyWorkspaceMembers(workspaceLike, {
        kind: "invite",
        title: "招待が承諾されました",
        href: "/settings",
        profileIds: managers.filter((id) => id !== accepted.id),
      });
    }
  }
  revalidatePath("/");
  revalidatePath("/settings");
  return { joined: previewRow?.company_name || "会社" };
}
