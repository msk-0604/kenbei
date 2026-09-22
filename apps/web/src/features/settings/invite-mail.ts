import { inviteEmailHtml, inviteEmailSubject, inviteEmailText, inviteJoinUrl } from "@kensapo/domain";
import { getAppUrl } from "@/lib/env";
import { sendKenbeiEmail } from "@/lib/mail";

export async function sendStoredInviteEmail(input: {
  email: string;
  companyName: string;
  roleCode: string;
  token: string;
}): Promise<{ ok: true } | { ok: false }> {
  const joinUrl = inviteJoinUrl(getAppUrl(), input.token);
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
