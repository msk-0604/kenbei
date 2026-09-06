import "server-only";

import { canDeliverPushToken } from "@kensapo/domain";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type ExpoMessage = {
  to: string;
  title: string;
  body?: string;
  data: Record<string, string>;
  sound: "default";
};

export async function sendExpoPushToMember(input: {
  organizationId: string;
  profileId: string;
  title: string;
  body?: string;
  data: Record<string, string>;
}): Promise<void> {
  if (!input.organizationId || !input.profileId) {
    return;
  }
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return;
  }
  const { data, error } = await admin
    .from("push_tokens")
    .select("token, organization_id, profile_id, active")
    .eq("organization_id", input.organizationId)
    .eq("profile_id", input.profileId)
    .eq("active", true);
  if (error || !data) {
    return;
  }
  const messages: ExpoMessage[] = [];
  for (const row of data as {
    token: string;
    organization_id: string;
    profile_id: string;
    active: boolean;
  }[]) {
    if (
      !canDeliverPushToken({
        tokenOrganizationId: row.organization_id,
        tokenProfileId: row.profile_id,
        tokenActive: row.active,
        targetOrganizationId: input.organizationId,
        targetProfileId: input.profileId,
      })
    ) {
      continue;
    }
    if (!row.token.startsWith("ExponentPushToken[")) {
      continue;
    }
    messages.push({
      to: row.token,
      title: input.title,
      body: input.body,
      sound: "default",
      data: {
        organizationId: input.organizationId,
        profileId: input.profileId,
        ...input.data,
      },
    });
  }
  if (messages.length === 0) {
    return;
  }
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  }).catch(() => undefined);
}
