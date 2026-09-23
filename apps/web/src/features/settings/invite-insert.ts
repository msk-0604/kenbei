export function newInviteInsertFields(input: {
  organizationId: string;
  roleId: string;
  token: string;
  invitedBy: string;
  expiresAt: string;
  email?: string | null;
  signupGrantHash?: string | null;
  signupGrantExpiresAt?: string | null;
}) {
  return {
    organization_id: input.organizationId,
    email: input.email ?? null,
    role_id: input.roleId,
    token: input.token,
    invited_by: input.invitedBy,
    expires_at: input.expiresAt,
    ...(input.signupGrantHash && input.signupGrantExpiresAt
      ? {
          signup_grant_hash: input.signupGrantHash,
          signup_grant_expires_at: input.signupGrantExpiresAt,
        }
      : {}),
  };
}
