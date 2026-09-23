import { inviteEmailHtml, inviteEmailSubject, inviteEmailText, inviteJoinUrl } from "@kensapo/domain";
import { getAppUrl } from "@/lib/env";
import { sendKenbeiEmail } from "@/lib/mail";

export function inviteMailJoinUrl(token: string, grant?: string | null): string {
  return inviteJoinUrl(getAppUrl(), token, grant);
}

export async function sendStoredInviteEmail(input: {
  email: string;
  companyName: string;
  roleCode: string;
  token: string;
  grant?: string | null;
}): Promise<{ ok: true } | { ok: false }> {
  const joinUrl = inviteMailJoinUrl(input.token, input.grant);
  const sent = await sendKenbeiEmail({
    to: input.email,
    subject: inviteEmailSubject(input.companyName),
    text: inviteEmailText({
      companyName: input.companyName,
      roleCode: input.roleCode,
      joinUrl,
    }),
    html: inviteEmailHtml({
      companyName: input.companyName,
      roleCode: input.roleCode,
      joinUrl,
    }),
  });
  return sent.ok ? { ok: true } : { ok: false };
}
