import { redirect } from "next/navigation";
import { assertPermission, hasPermission, type PermissionCode } from "@kensapo/authz";
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
