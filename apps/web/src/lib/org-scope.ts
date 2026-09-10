import "server-only";

import { requireWorkspace } from "@/lib/authz-guard";

export async function currentOrganizationId(): Promise<string> {
  const workspace = await requireWorkspace();
  return workspace.organizationId;
}
