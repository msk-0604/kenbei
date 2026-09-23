export type InvitePreviewRow = {
  company_name: string | null;
  role_label: string | null;
  invite_state: string | null;
  email_state: string | null;
  invited_email: string | null;
};

export function firstInvitePreview(data: unknown): InvitePreviewRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return null;
  }
  const value = row as Record<string, unknown>;
  return {
    company_name: typeof value.company_name === "string" ? value.company_name : null,
    role_label: typeof value.role_label === "string" ? value.role_label : null,
    invite_state: typeof value.invite_state === "string" ? value.invite_state : null,
    email_state: typeof value.email_state === "string" ? value.email_state : null,
    invited_email: typeof value.invited_email === "string" ? value.invited_email : null,
  };
}
