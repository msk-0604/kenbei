import { createHash, randomBytes } from "node:crypto";
import { isInviteSignupGrantSecret } from "@kensapo/domain";

const GRANT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function hashInviteSignupGrant(secret: string): string {
  return createHash("sha256").update(secret.toLowerCase(), "utf8").digest("hex");
}

export function inviteSignupGrantExpiresAt(inviteExpiresAt: Date, now = Date.now()): Date {
  const cap = now + GRANT_TTL_MS;
  return inviteExpiresAt.getTime() <= cap ? inviteExpiresAt : new Date(cap);
}

export function createInviteSignupGrant(inviteExpiresAt: Date, now = Date.now()): {
  secret: string;
  hash: string;
  expiresAt: Date;
} {
  const secret = randomBytes(32).toString("hex");
  return {
    secret,
    hash: hashInviteSignupGrant(secret),
    expiresAt: inviteSignupGrantExpiresAt(inviteExpiresAt, now),
  };
}

export function readInviteSignupGrant(value: string | null | undefined): string | null {
  const grant = (value ?? "").trim().toLowerCase();
  return isInviteSignupGrantSecret(grant) ? grant : null;
}

export function isMissingInviteSignupGrantRpc(message: string | null | undefined): boolean {
  const text = (message ?? "").toLowerCase();
  return text.includes("consume_invite_signup_grant") && (text.includes("does not exist") || text.includes("schema cache"));
}
