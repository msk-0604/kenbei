/**
 * Local-only Playwright invite E2E. Does not use Production or .env.local.
 */
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webPkg = resolve(root, "apps/web/package.json");
const require = createRequire(webPkg);
const { createClient } = require("@supabase/supabase-js");

const appUrl = process.env.KENBEI_LOCAL_APP_URL || "http://localhost:3000";
const supabaseUrl = "http://127.0.0.1:54321";
const mailpitUrl = "http://127.0.0.1:54324";

const statusEnv = execFileSync("npx", ["supabase", "status", "-o", "env"], {
  encoding: "utf8",
  shell: true,
  cwd: root,
});
const envMap = Object.fromEntries(
  statusEnv
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^"|"$/g, "")]),
);
const anon = envMap.ANON_KEY;
const service = envMap.SERVICE_ROLE_KEY;
if (!anon?.startsWith("eyJ") || !service?.startsWith("eyJ")) {
  throw new Error("local supabase keys missing");
}

function ensurePlaywright() {
  const cache = resolve(tmpdir(), "kenbei-playwright");
  mkdirSync(cache, { recursive: true });
  try {
    return createRequire(resolve(cache, "package.json"))("playwright");
  } catch {
    execFileSync("npm", ["init", "-y"], { cwd: cache, stdio: "ignore", shell: true });
    execFileSync("npm", ["install", "playwright@1.55.0", "--no-fund", "--no-audit"], {
      cwd: cache,
      stdio: "inherit",
      shell: true,
    });
    execFileSync("npx", ["playwright", "install", "chromium"], {
      cwd: cache,
      stdio: "inherit",
      shell: true,
    });
    return createRequire(resolve(cache, "package.json"))("playwright");
  }
}

async function seedInvite(kind) {
  const stamp = Date.now();
  const ownerEmail = `pw-owner-${kind}-${stamp}@example.test`;
  const inviteeEmail = `pw-invitee-${kind}-${stamp}@example.test`;
  const password = "password12";
  const admin = createClient(supabaseUrl, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const ownerCreated = await admin.auth.admin.createUser({
    email: ownerEmail,
    password,
    email_confirm: true,
  });
  if (ownerCreated.error) {
    throw new Error(`owner create: ${ownerCreated.error.message}`);
  }
  const owner = createClient(supabaseUrl, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await owner.auth.signInWithPassword({ email: ownerEmail, password });
  if (signed.error) {
    throw new Error(`owner login: ${signed.error.message}`);
  }
  const org = await owner.rpc("create_organization", { p_name: `PW招待 ${kind} ${stamp}` });
  if (org.error) {
    throw new Error(`create_organization: ${org.error.message}`);
  }
  const role = await owner.from("roles").select("id").eq("code", "worker").is("organization_id", null).maybeSingle();
  const token = `${stamp.toString(16).padStart(16, "0")}${kind === "copy" ? "d" : "c".repeat(16)}`.padEnd(32, "d");
  const grantSecret = kind === "email" ? randomBytes(32).toString("hex") : null;
  const invite = await owner.from("organization_invitations").insert({
    organization_id: org.data,
    email: inviteeEmail,
    role_id: role.data.id,
    token,
    invited_by: ownerCreated.data.user.id,
    expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    ...(grantSecret
      ? {
          signup_grant_hash: createHash("sha256").update(grantSecret, "utf8").digest("hex"),
          signup_grant_expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
        }
      : {}),
  });
  if (invite.error) {
    throw new Error(`invite insert: ${invite.error.message}`);
  }
  return { token, grant: grantSecret, inviteeEmail, password, company: `PW招待 ${kind} ${stamp}`, kind };
}

async function confirmationLink(email, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const list = await fetch(`${mailpitUrl}/api/v1/messages`);
    const body = await list.json();
    const messages = body.messages ?? [];
    const hit = messages.find((m) => JSON.stringify(m).toLowerCase().includes(email.toLowerCase()));
    if (hit?.ID) {
      const detail = await fetch(`${mailpitUrl}/api/v1/message/${hit.ID}`);
      const mail = await detail.json();
      const html = mail.HTML || mail.Text || "";
      const match =
        html.match(/https?:\/\/[^"'\\\s]+auth\/v1\/verify[^"'\\\s]+/i) ||
        html.match(/https?:\/\/localhost:\d+\/auth\/callback[^"'\\\s]*/i) ||
        html.match(/href="(https?:\/\/[^"]+)"/i);
      const raw = match?.[0]?.replace(/^href="/, "") || match?.[1];
      if (raw) {
        return raw.replace(/&amp;/g, "&");
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("confirmation email not found in mailpit");
}

async function runJoinFlow(page, seed) {
  const failBits = [];
  const joinUrl =
    seed.kind === "email" && seed.grant
      ? `${appUrl}/join?token=${seed.token}&grant=${seed.grant}`
      : `${appUrl}/join?token=${seed.token}`;
  await page.goto(joinUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("heading", { name: `${seed.company}から招待されています` }).waitFor({ timeout: 60000 });
  const locked = await page.locator('input[name="email"]').inputValue();
  if (locked.toLowerCase() !== seed.inviteeEmail) {
    failBits.push(`email not locked to invitee: ${locked}`);
  }
  await page.locator('input[name="password"]').fill(seed.password);
  const submitName = seed.kind === "email" ? "登録" : "アカウントを作成して参加";
  await page.getByRole("button", { name: submitName }).click();
  if (seed.kind === "copy") {
    await page.waitForTimeout(2000);
    const joinError = await page.locator("p.text-red-600").textContent().catch(() => "");
    if (joinError) {
      failBits.push(`join form error: ${joinError}`);
      return { failBits, finalUrl: page.url() };
    }
    await Promise.race([
      page.waitForURL(/\/signup\/check-email/, { timeout: 60000 }),
      page.getByRole("heading", { name: /メールを確認/ }).waitFor({ timeout: 60000 }),
    ]);
    const link = await confirmationLink(seed.inviteeEmail);
    if (/\/auth\/v1\/verify/i.test(link)) {
      const bounced = await fetch(link, { redirect: "manual" });
      const nextHop = bounced.headers.get("location");
      if (!nextHop) {
        throw new Error("verify redirect missing Location");
      }
      await page.goto(nextHop, { waitUntil: "domcontentloaded", timeout: 60000 });
    } else {
      await page.goto(link, { waitUntil: "domcontentloaded", timeout: 60000 });
    }
  }
  const host = new URL(appUrl).host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.waitForURL(new RegExp(`${host}(/|\\?|$)`), { timeout: 60000 });
  const url = page.url();
  if (url.includes("/login")) {
    failBits.push(`landed on login: ${url}`);
  }
  if (url.includes("/signup")) {
    failBits.push(`stuck on signup: ${url}`);
  }
  await page.getByRole("heading", { name: "今日", exact: true }).waitFor({ timeout: 30000 });
  if (page.url().includes("/login")) {
    failBits.push("today shown but url still login");
  }
  return { failBits, finalUrl: page.url() };
}

async function main() {
  const { chromium } = ensurePlaywright();
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const kind of (process.env.KENBEI_E2E_KIND ? [process.env.KENBEI_E2E_KIND] : ["email", "copy"])) {
      const seed = await seedInvite(kind);
      const page = await browser.newPage();
      try {
        const run = await runJoinFlow(page, seed);
        results.push({
          kind,
          result: run.failBits.length ? "FAIL" : "PASS",
          finalUrl: run.finalUrl,
          extraLogin: run.failBits,
          email: seed.inviteeEmail,
        });
        if (kind === "email" && seed.grant && run.failBits.length === 0) {
          const reuse = await browser.newPage();
          try {
            await reuse.goto(`${appUrl}/join?token=${seed.token}&grant=${seed.grant}`, {
              waitUntil: "domcontentloaded",
              timeout: 60000,
            });
            await reuse.locator('input[name="password"]').fill(seed.password).catch(() => {});
            const register = reuse.getByRole("button", { name: "登録" });
            if (await register.count()) {
              await register.click();
              const reuseError = await reuse.locator("p.text-red-600").textContent({ timeout: 15000 });
              results.push({
                kind: "reuse",
                result: /無効か、すでに使われています/.test(reuseError || "") ? "PASS" : "FAIL",
                extraLogin: reuseError ? [] : ["missing reuse error"],
              });
            } else {
              const heading = await reuse.getByRole("heading").first().textContent();
              results.push({
                kind: "reuse",
                result: /使われています|所属しています/.test(heading || "") ? "PASS" : "FAIL",
                extraLogin: [heading || "no heading"],
              });
            }
          } finally {
            await reuse.close();
          }
        }
      } catch (error) {
        const shot = resolve(root, "scripts/e2e-invite-last.png");
        try {
          await page.screenshot({ path: shot, fullPage: true });
        } catch {
          // ignore
        }
        results.push({
          kind,
          result: "FAIL",
          error: String(error),
          url: page.url(),
          title: await page.title().catch(() => ""),
        });
      } finally {
        await page.close();
      }
    }
    console.log(JSON.stringify({ result: results.every((r) => r.result === "PASS") ? "PASS" : "FAIL", cases: results }));
    if (results.some((r) => r.result !== "PASS")) {
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

await main();
