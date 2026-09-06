import { getAppUrl } from "./env";
import { supabase } from "./supabase";

export async function notifyOrgMembers(input: {
  organizationId: string;
  projectId?: string;
  kind: string;
  title: string;
  body?: string;
  href?: string;
  profileIds?: string[];
  permissionAudience?: string;
  extra?: Record<string, string>;
}): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token || !input.organizationId) {
    return;
  }
  await fetch(`${getAppUrl()}/api/push/notify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  }).catch(() => undefined);
}
