"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canMutateMembershipInOrganization,
  canResendInvite,
  inviteCancelUpdate,
  inviteDuplicateEmailMessage,
  inviteJoinPath,
  isInviteRoleCode,
  normalizeInviteEmail,
} from "@kensapo/domain";
import { assertOrganizationWritable, can, requireWorkspace } from "@/lib/authz-guard";
import { getAppUrl } from "@/lib/env";
import { assertSeatAvailable } from "@/lib/entitlement";
import { formString } from "@/lib/form";
import { toUserActionError } from "@/lib/user-error";
import { logoStoragePath } from "@/lib/storage-paths";
import { newInviteInsertFields } from "@/features/settings/invite-insert";
import { sendStoredInviteEmail } from "@/features/settings/invite-mail";
import { acceptInviteForCurrentUser } from "@/features/settings/accept-invite";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function updateCompanySettingsAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  const locked = await assertOrganizationWritable(workspace.organizationId);
  if (locked) {
    return locked;
  }
  if (!can(workspace, "org.manage")) {
    return { error: "設定を変更する権限がありません。" };
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
      return { error: toUserActionError(upload.error.message, "設定を保存") };
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
    return { error: toUserActionError(error.message, "設定を保存") };
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
  _prev: { error: string } | { url: string; email: string; mailed: boolean } | null,
  formData: FormData,
): Promise<{ error: string } | { url: string; email: string; mailed: boolean } | null> {
  const workspace = await requireWorkspace();
  const locked = await assertOrganizationWritable(workspace.organizationId);
  if (locked) {
    return locked;
  }
  if (!can(workspace, "member.manage")) {
    return { error: "メンバーを招待する権限がありません。" };
  }
  const seat = await assertSeatAvailable(workspace);
  if (seat) {
    return seat;
  }
  const email = normalizeInviteEmail(formString(formData, "email"));
  if (!email) {
    return { error: "メールアドレスを入力してください。" };
  }
  const roleCode = formString(formData, "roleCode") || "worker";
  if (!isInviteRoleCode(roleCode)) {
    return { error: "権限を選んでください。" };
  }
  const supabase = await createServerSupabaseClient();
  const role = await supabase
    .from("roles")
    .select("id, code")
    .eq("code", roleCode)
    .is("organization_id", null)
    .is("deleted_at", null)
    .maybeSingle();
  const roleRow = role.data as { id: string; code: string } | null;
  if (!roleRow) {
    return { error: "権限が見つかりません。" };
  }
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expires = new Date();
  expires.setDate(expires.getDate() + 14);
  const { error } = await supabase.from("organization_invitations").insert(
    newInviteInsertFields({
      organizationId: workspace.organizationId,
      roleId: roleRow.id,
      token,
      invitedBy: workspace.userId,
      expiresAt: expires.toISOString(),
      email,
    }),
  );
  if (error) {
    const message = error.message ?? "";
    if (message.includes("KENBEI_SEAT_LIMIT")) {
      return { error: "座席数が上限です。プランを変更するか、無効な席を整理してください。" };
    }
    if (message.includes("KENBEI_INVITE_ROLE") || message.includes("KENBEI_OWNER_GRANT")) {
      return { error: "この権限では招待できません。" };
    }
    if (message.includes("organization_invitations_pending_email_uidx") || message.includes("duplicate key")) {
      return { error: inviteDuplicateEmailMessage() };
    }
    return { error: toUserActionError(error.message, "招待メールを送る") };
  }
  const mailed = await sendStoredInviteEmail({
    email,
    companyName: workspace.organizationName,
    roleCode: roleRow.code,
    token,
  });
  revalidatePath("/settings");
  return {
    url: `${getAppUrl()}${inviteJoinPath(token)}`,
    email,
    mailed: mailed.ok,
  };
}

export async function resendInviteAction(
  _prev: { error: string } | { mailed: true } | { mailed: false } | null,
  formData: FormData,
): Promise<{ error: string } | { mailed: true } | { mailed: false } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "member.manage")) {
    return { error: "招待を再送する権限がありません。" };
  }
  const inviteId = formString(formData, "inviteId");
  if (!/^[0-9a-f-]{36}$/i.test(inviteId)) {
    return { error: "招待が見つかりません。" };
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("organization_invitations")
    .select("id, organization_id, email, token, accepted_at, deleted_at, roles(code)")
    .eq("id", inviteId)
    .eq("organization_id", workspace.organizationId)
    .is("accepted_at", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    return { error: toUserActionError(error.message, "招待メールを再送") };
  }
  const row = data as {
    organization_id: string;
    email: string | null;
    token: string;
    accepted_at: string | null;
    deleted_at: string | null;
    roles: { code: string } | { code: string }[] | null;
  } | null;
  if (!row) {
    return { error: "この招待は再送できません。" };
  }
  const allowed = canResendInvite({
    sessionOrganizationId: workspace.organizationId,
    inviteOrganizationId: row.organization_id,
    accepted: Boolean(row.accepted_at),
    alreadyDeleted: Boolean(row.deleted_at),
    email: row.email,
  });
  if (!allowed.ok) {
    return { error: allowed.reason === "other_org" ? "招待を再送する権限がありません。" : "この招待は再送できません。" };
  }
  const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
  const mailed = await sendStoredInviteEmail({
    email: normalizeInviteEmail(row.email) ?? "",
    companyName: workspace.organizationName,
    roleCode: role?.code || "worker",
    token: row.token,
  });
  return mailed.ok ? { mailed: true } : { mailed: false };
}

export async function cancelInviteAction(
  _prev: { error: string } | { canceled: true } | null,
  formData: FormData,
): Promise<{ error: string } | { canceled: true } | null> {
  const workspace = await requireWorkspace();
  if (!can(workspace, "member.manage")) {
    return { error: "招待を取り消す権限がありません。" };
  }
  const inviteId = formString(formData, "inviteId");
  if (!/^[0-9a-f-]{36}$/i.test(inviteId)) {
    return { error: "招待が見つかりません。" };
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("organization_invitations")
    .update(inviteCancelUpdate(new Date().toISOString()))
    .eq("id", inviteId)
    .eq("organization_id", workspace.organizationId)
    .is("accepted_at", null)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    return { error: toUserActionError(error.message, "招待を取り消す") };
  }
  if (!data) {
    return { error: "この招待は取り消せません。" };
  }
  revalidatePath("/settings");
  return { canceled: true };
}

export async function acceptInviteAction(
  token: string,
): Promise<{ error: string } | { joined: string } | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(inviteJoinPath(token))}`);
  }
  return acceptInviteForCurrentUser(token);
}

export async function setMembershipStatusAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workspace = await requireWorkspace();
  const locked = await assertOrganizationWritable(workspace.organizationId);
  if (locked) {
    return locked;
  }
  if (!can(workspace, "member.manage")) {
    return { error: "メンバーを変更する権限がありません。" };
  }
  const membershipId = formString(formData, "membershipId");
  const nextStatus = formString(formData, "status");
  if (!membershipId || (nextStatus !== "active" && nextStatus !== "disabled")) {
    return { error: "対象が不正です。" };
  }
  if (nextStatus === "active") {
    const seat = await assertSeatAvailable(workspace);
    if (seat) {
      return seat;
    }
  }
  const supabase = await createServerSupabaseClient();
  const target = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("id", membershipId)
    .is("deleted_at", null)
    .maybeSingle();
  const targetOrgId = (target.data as { organization_id: string } | null)?.organization_id;
  if (!targetOrgId || !canMutateMembershipInOrganization(workspace.organizationId, targetOrgId)) {
    return { error: "メンバーを変更する権限がありません。" };
  }
  const { error } = await supabase.rpc("set_membership_status", {
    p_membership_id: membershipId,
    p_status: nextStatus,
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("KENBEI_SELF_DISABLE")) {
      return { error: "自分自身は無効化できません。" };
    }
    if (message.includes("KENBEI_LAST_OWNER")) {
      return { error: "最後の代表は無効化できません。" };
    }
    if (message.includes("KENBEI_LAST_MANAGER")) {
      return { error: "最後の管理者は無効化できません。" };
    }
    if (message.includes("KENBEI_SEAT_LIMIT")) {
      return { error: "座席数が上限です。プランを変更するか、無効な席を整理してください。" };
    }
    if (message.includes("permission denied")) {
      return { error: "メンバーを変更する権限がありません。" };
    }
    return { error: error.message };
  }
  revalidatePath("/settings");
  revalidatePath("/");
  return null;
}

