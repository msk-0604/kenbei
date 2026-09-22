import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(resolve(process.cwd(), "apps/web/src/features/settings/actions.ts"), "utf8");
const auth = readFileSync(resolve(process.cwd(), "apps/web/src/features/auth/actions.ts"), "utf8");
const trial = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260919120000_app_owned_14_day_trial.sql"),
  "utf8",
);

describe("invite action guards", () => {
  it("lets only member managers create invites", () => {
    expect(actions).toMatch(/if \(!can\(workspace, "member\.manage"\)\)/);
    expect(actions).toMatch(/isInviteRoleCode\(roleCode\)/);
    expect(actions).toMatch(/newInviteInsertFields/);
  });

  it("lets only org managers update company settings", () => {
    expect(actions).toMatch(/if \(!can\(workspace, "org\.manage"\)\) \{\s*return \{ error: "設定を変更する権限がありません。"/s);
    expect(actions).not.toMatch(/org\.manage"\) && !can\(workspace, "member\.manage"\)/);
  });

  it("cancels pending invites only in the session company", () => {
    expect(actions).toMatch(/export async function cancelInviteAction/);
    expect(actions).toMatch(/招待を取り消す権限がありません/);
    expect(actions).toMatch(/\.eq\("organization_id", workspace\.organizationId\)/);
    expect(actions).toMatch(/inviteCancelUpdate/);
    expect(actions).toMatch(/\.is\("accepted_at", null\)/);
    const cancelFn = actions.slice(actions.indexOf("export async function cancelInviteAction"), actions.indexOf("export async function acceptInviteAction"));
    expect(cancelFn).toMatch(/\.is\("deleted_at", null\)/);
    expect(cancelFn).not.toMatch(/memberships/);
  });

  it("accepts with token only", () => {
    expect(actions).toMatch(/rpc\("accept_organization_invite", \{ p_token: token \}\)/);
    expect(actions).not.toMatch(/rpc\("accept_organization_invite", \{[^}]*organization/);
  });
});

describe("auth invite return path", () => {
  it("keeps signup login and reset", () => {
    expect(auth).toMatch(/signUp\(/);
    expect(auth).toMatch(/emailRedirectTo/);
    expect(auth).toMatch(/auth\/callback\?next=/);
    expect(auth).toMatch(/signInWithPassword/);
    expect(auth).toMatch(/resetPasswordForEmail/);
  });
});

describe("trial source is unchanged by this task", () => {
  it("still starts a 14 day trial only on new organizations", () => {
    expect(trial).toMatch(/'free',\s*'trialing',\s*now\(\) \+ interval '14 days'/);
    expect(trial).not.toMatch(/organization_invitations/);
  });
});
