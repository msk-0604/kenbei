import { redirect } from "next/navigation";
import { assertPermission, hasPermission, type PermissionCode } from "@kensapo/authz";
import { workspaceWriteBlockMessage } from "@kensapo/domain";
import { getEntitlement } from "@/lib/entitlement";
import { getWorkspace, hasOrganization, type Workspace } from "@/lib/session";

export async function requireWorkspace(): Promise<Workspace> {
  const workspace = await getWorkspace();
  if (!workspace) {
    redirect("/login");
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
