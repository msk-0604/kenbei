"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SYSTEM_ROLE_CODES, type SystemRoleCode } from "@kensapo/domain";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { getAppUrl } from "@/lib/env";
import { assertSeatAvailable } from "@/lib/entitlement";
import { formString } from "@/lib/form";
import { listMemberProfileIdsWithPermission, notifyWorkspaceMembers } from "@/lib/notifications";
import type { Workspace } from "@/lib/session";
import { logoStoragePath } from "@/lib/storage-paths";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function isRole(value: string): value is SystemRoleCode {
  return (SYSTEM_ROLE_CODES as readonly string[]).includes(value);
}

export async function updateCompanySettingsAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "org.manage") && !can(workspace, "member.manage")) {
    return { error: "会社設定を変更する権限がありません。" };
  }
  const displayName = formString(formData, "companyDisplayName");
  const supabase = await createServerSupabaseClient();
  const logo = formData.get("logo");
  let logoPath: string | null | undefined;
  if (logo instanceof File && logo.size > 0) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(logo.type)) {
      return { error: "ロゴは PNG / JPEG / WebP です。" };
    }
    if (logo.size > 2 * 1024 * 1024) {
      return { error: "ロゴは2MBまでです。" };
    }
    const path = logoStoragePath(workspace.organizationId, logo.name);
    const upload = await supabase.storage.from("org-files").upload(path, logo, {
      contentType: logo.type,
      upsert: true,
    });
    if (upload.error) {
      return { error: upload.error.message };
    }
    logoPath = path;
  }
  const payload: { company_display_name: string | null; logo_storage_path?: string } = {
    company_display_name: displayName || null,
  };
  if (logoPath) {
    payload.logo_storage_path = logoPath;
  }
  const { error } = await supabase
    .from("organization_settings")
    .update(payload)
    .eq("organization_id", workspace.organizationId);
  if (error) {
    return { error: error.message };
  }
  if (displayName && can(workspace, "org.manage")) {
    await supabase
      .from("organizations")
      .update({ name: displayName, updated_by: workspace.userId })
      .eq("id", workspace.organizationId);
  }
  revalidatePath("/settings");
  revalidatePath("/");
  return null;
}

export async function createInviteAction(
  _prev: { error: string } | { url: string } | null,
  formData: FormData,
): Promise<{ error: string } | { url: string } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "member.manage")) {
    return { error: "メンバーを招待する権限がありません。" };
  }
  const seat = await assertSeatAvailable(workspace);
  if (seat) {
    return seat;
  }
  const email = formString(formData, "email").toLowerCase();
  const roleCode = formString(formData, "roleCode") || "worker";
  if (!email || !email.includes("@")) {
    return { error: "メールアドレスを入力してください。" };
  }
  if (!isRole(roleCode) || roleCode === "owner") {
    return { error: "役割を選んでください。" };
  }
  const supabase = await createServerSupabaseClient();
  const role = await supabase
    .from("roles")
    .select("id")
    .eq("code", roleCode)
    .is("organization_id", null)
    .is("deleted_at", null)
    .maybeSingle();
  const roleRow = role.data as { id: string } | null;
  if (!roleRow) {
    return { error: "役割が見つかりません。" };
  }
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expires = new Date();
  expires.setDate(expires.getDate() + 14);
  const { error } = await supabase.from("organization_invitations").insert({
    organization_id: workspace.organizationId,
    email,
    role_id: roleRow.id,
    token,
    invited_by: workspace.userId,
    expires_at: expires.toISOString(),
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/settings");
  return { url: `${getAppUrl()}/join?token=${token}` };
}

export async function acceptInviteAction(token: string): Promise<{ error: string } | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join?token=${token}`)}`);
  }
  const { error } = await supabase.rpc("accept_organization_invite", { p_token: token });
  if (error) {
    return { error: error.message };
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
  redirect("/");
}
