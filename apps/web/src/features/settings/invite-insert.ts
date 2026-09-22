export function newInviteInsertFields(input: {
  organizationId: string;
  roleId: string;
  token: string;
  invitedBy: string;
  expiresAt: string;
  email?: string | null;
}) {
  return {
    organization_id: input.organizationId,
    email: input.email ?? null,
    role_id: input.roleId,
    token: input.token,
    invited_by: input.invitedBy,
    expires_at: input.expiresAt,
  };
}
