import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const join = readFileSync(resolve(process.cwd(), "apps/web/src/app/join/page.tsx"), "utf8");
const joinActions = readFileSync(resolve(process.cwd(), "apps/web/src/features/settings/join-actions.ts"), "utf8");
const checkEmail = readFileSync(resolve(process.cwd(), "apps/web/src/app/signup/check-email/page.tsx"), "utf8");
const mail = readFileSync(resolve(process.cwd(), "apps/web/src/features/settings/invite-mail.ts"), "utf8");
const callback = readFileSync(resolve(process.cwd(), "apps/web/src/app/auth/callback/route.ts"), "utf8");
const forms = readFileSync(resolve(process.cwd(), "apps/web/src/features/settings/forms.tsx"), "utf8");
const settings = readFileSync(resolve(process.cwd(), "apps/web/src/app/settings/page.tsx"), "utf8");
const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260922160000_invite_preview_invited_email.sql"),
  "utf8",
);

describe("invite join signup flow", () => {
  it("skips confirmation only after a one-time emailed grant is consumed", () => {
    expect(join).toMatch(/JoinSignupForm/);
    expect(join).toMatch(/inviteJoinSignupHint/);
    expect(join).toMatch(/hasGrant \? "grant" : "confirm"/);
    expect(joinActions).toMatch(/export async function joinSignupAction/);
    expect(joinActions).toMatch(/auth\.signUp/);
    expect(joinActions).toMatch(/inviteCheckEmailPath/);
    expect(joinActions).toMatch(/resend\(/);
    expect(joinActions).toMatch(/consume_invite_signup_grant/);
    expect(joinActions).toMatch(/canSkipInviteEmailConfirmation\(\{ grantRedeemed/);
    expect(joinActions).toMatch(/email_confirm: true/);
    expect(joinActions).toMatch(/createUser/);
    expect(joinActions).toMatch(/authUserExistsByEmail/);
    expect(joinActions).toMatch(/releaseInviteSignupGrant/);
    expect(joinActions).toMatch(/isMissingInviteSignupGrantRpc/);
    expect(joinActions).toMatch(/currentEmail === email/);
    expect(joinActions).not.toMatch(/inviteEmailProofValid/);
    expect(joinActions).not.toMatch(/updateUser/);
    expect(joinActions).not.toMatch(/generateLink/);
    expect(joinActions).not.toMatch(/deleteUser/);
    expect(checkEmail).toMatch(/inviteConfirmInboxSteps/);
    expect(checkEmail).toMatch(/CheckEmailResend/);
  });

  it("puts the grant only on the emailed URL, not the copied link", () => {
    expect(mail).toMatch(/inviteJoinUrl\(getAppUrl\(\), token, grant\)/);
    expect(mail).not.toMatch(/createInviteEmailProof/);
    expect(mail).not.toMatch(/INVITE_PROOF_SECRET/);
    expect(forms).toMatch(/招待リンクをコピー/);
    expect(forms).toMatch(/invite\.token/);
    expect(forms).not.toMatch(/&grant=/);
  });

  it("auto-accepts after confirmation and does not weaken RLS", () => {
    expect(callback).toMatch(/inviteTokenFromNextPath/);
    expect(callback).toMatch(/acceptInviteForCurrentUser/);
    expect(callback).toMatch(/new URL\("\/"/);
    expect(sql).toMatch(/invited_email/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.preview_organization_invite\(text\) TO anon, authenticated/);
    expect(sql).not.toMatch(/CREATE\s+POLICY/i);
    expect(sql).not.toMatch(/DROP\s+POLICY/i);
    expect(sql).not.toMatch(/service_role/i);
    expect(sql).not.toMatch(/billing_plans/i);
    expect(sql).not.toMatch(/stripe/i);
  });

  it("counts active members separately from pending invites", () => {
    expect(settings).toMatch(/メンバー \{memberCount\}人/);
    expect(settings).toMatch(/招待中/);
    expect(settings).toMatch(/PendingInvitesList/);
  });
});
