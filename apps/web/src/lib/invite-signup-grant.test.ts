import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createInviteSignupGrant,
  hashInviteSignupGrant,
  inviteSignupGrantExpiresAt,
  isMissingInviteSignupGrantRpc,
  readInviteSignupGrant,
} from "./invite-signup-grant";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260923180000_invite_signup_grant.sql"), "utf8");
const auth = readFileSync(resolve(process.cwd(), "apps/web/src/features/auth/actions.ts"), "utf8");
const config = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");

describe("invite signup grant", () => {
  it("hashes the secret and does not treat a token-only URL as redeemable", () => {
    const issued = createInviteSignupGrant(new Date("2026-10-07T00:00:00.000Z"), Date.parse("2026-09-23T00:00:00.000Z"));
    expect(issued.expiresAt.toISOString()).toBe("2026-10-07T00:00:00.000Z");
    expect(issued.secret).toMatch(/^[a-f0-9]{64}$/);
    expect(issued.hash).toBe(createHash("sha256").update(issued.secret, "utf8").digest("hex"));
    expect(hashInviteSignupGrant(issued.secret.toUpperCase())).toBe(issued.hash);
    expect(readInviteSignupGrant(issued.secret)).toBe(issued.secret);
    expect(readInviteSignupGrant("not-a-grant")).toBeNull();
  });

  it("consumes grants only via service_role and does not weaken RLS or billing", () => {
    expect(sql).toMatch(/signup_grant_hash/);
    expect(sql).toMatch(/signup_grant_used_at/);
    expect(sql).toMatch(/consume_invite_signup_grant/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.consume_invite_signup_grant\(text, text\) TO service_role/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.consume_invite_signup_grant\(text, text\) FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/signup_grant_used_at IS NULL/);
    expect(sql).toMatch(/signup_grant_expires_at > now\(\)/);
    expect(sql).not.toMatch(/CREATE\s+POLICY/i);
    expect(sql).not.toMatch(/DROP\s+POLICY/i);
    expect(sql).not.toMatch(/billing_plans/i);
    expect(sql).not.toMatch(/organization_billing/i);
    expect(sql).not.toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).not.toMatch(/email_confirm/i);
  });

  it("leaves general signup confirmation and local Auth confirmations on", () => {
    expect(auth).toMatch(/signUp\(/);
    expect(auth).toMatch(/emailRedirectTo/);
    expect(auth).not.toMatch(/createUser/);
    expect(auth).not.toMatch(/email_confirm/);
    expect(config).toMatch(/enable_confirmations = true/);
  });

  it("never lets a grant outlive the invite and treats a missing RPC as fallback", () => {
    const now = Date.parse("2026-09-23T00:00:00.000Z");
    expect(inviteSignupGrantExpiresAt(new Date("2026-09-25T00:00:00.000Z"), now).toISOString()).toBe(
      "2026-09-25T00:00:00.000Z",
    );
    expect(inviteSignupGrantExpiresAt(new Date("2026-12-01T00:00:00.000Z"), now).getTime()).toBe(now + 14 * 86400000);
    expect(isMissingInviteSignupGrantRpc("function consume_invite_signup_grant(text, text) does not exist")).toBe(true);
    expect(isMissingInviteSignupGrantRpc("invalid grant")).toBe(false);
  });
});
