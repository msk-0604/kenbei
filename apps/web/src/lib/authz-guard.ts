import { redirect } from "next/navigation";
import { assertPermission, hasPermission, type PermissionCode } from "@kensapo/authz";
import { CREW_ROLE_CODE, workspaceWriteBlockMessage } from "@kensapo/domain";
import { getEntitlement } from "@/lib/entitlement";
import { getWorkspace, hasOrganization, type Workspace } from "@/lib/session";

export async function requireWorkspace(): Promise<Workspace> {
  const workspace = await getWorkspace();
  if (!workspace) {
    // middleware を通ってここに来るのは、トークンはあるがセッションが無効なとき（共通ログインの締め出しなど）
    redirect("/login?signedout=1");
  }
  if (!hasOrganization(workspace)) {
    redirect("/onboarding");
  }
  return workspace;
}

export function requirePermission(workspace: Workspace, permission: PermissionCode): void {
  assertPermission(workspace.permissions, permission);
}

export function can(workspace: Workspace, permission: PermissionCode): boolean {
  return hasPermission(workspace.permissions, permission);
}

export async function assertOrganizationWritable(organizationId: string): Promise<{ error: string } | null> {
  const entitlement = await getEntitlement(organizationId);
  const message = workspaceWriteBlockMessage(entitlement.access);
  if (message) {
    return { error: message };
  }
  return null;
}

export async function requireWritableWorkspace(): Promise<Workspace | { error: string }> {
  const workspace = await requireWorkspace();
  const locked = await assertOrganizationWritable(workspace.organizationId);
  return locked ?? workspace;
}

/** kenbei-alpha の「管理者」= 現場を登録できる人（Owner / Executive / Manager / Office） */
export function isSiteAdmin(workspace: Workspace): boolean {
  return can(workspace, "project.create");
}

/** 会社共通の合言葉でログインしている端末（誰が見ているかはサーバーでは分からない） */
export function isCrewLogin(workspace: Workspace): boolean {
  return workspace.roleCode === CREW_ROLE_CODE;
}

export async function requireSiteAdmin(): Promise<Workspace> {
  const workspace = await requireWorkspace();
  if (!isSiteAdmin(workspace)) {
    redirect("/today");
  }
  return workspace;
}
