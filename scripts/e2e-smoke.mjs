// KENBEI 本番（またはプレビュー）の通し確認。ログインして主な画面とボタンを順に開き、
// エラー・壊れたリンク・表示までの時間を表にする。データは作らない（読むだけ）。
//
//   KENBEI_E2E_BASE_URL=https://app.kenbei.jp \
//   KENBEI_E2E_EMAIL=... KENBEI_E2E_PASSWORD=... \
//   node scripts/e2e-smoke.mjs
//
// アカウントはテスト用の会社の管理者にすること（お客さんの会社では使わない）。
// playwright はリポジトリに入れていないので、入っている場所から読む（Claude Code の環境は /opt/node22 に入っている）
const { chromium } = await import("playwright").catch(() => import("/opt/node22/lib/node_modules/playwright/index.mjs"));

const base = (process.env.KENBEI_E2E_BASE_URL ?? "https://app.kenbei.jp").replace(/\/$/, "");
const email = process.env.KENBEI_E2E_EMAIL;
const password = process.env.KENBEI_E2E_PASSWORD;
if (!email || !password) {
  console.error("KENBEI_E2E_EMAIL と KENBEI_E2E_PASSWORD を設定してください。");
  process.exit(2);
}

// 開く画面（ログインが必要なもの）
const PAGES = [
  "/today",
  "/schedule",
  "/schedule/new",
  "/kanri",
  "/kanri/schedules",
  "/kanri/presets",
  "/kanri/archive",
  "/sites",
  "/sites/new",
  "/workers",
  "/workers/new",
  "/reports",
  "/tasks",
  "/notices",
  "/settings",
  "/settings/billing",
  "/settings/members",
  "/settings/passkey",
  "/help",
  "/account",
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ja-JP" });
const page = await context.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`[${page.url().replace(base, "")}] JS エラー: ${e.message.slice(0, 160)}`));
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`[${page.url().replace(base, "")}] console: ${m.text().slice(0, 160)}`);
});

// 1. ログイン
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
try {
  await page.fill('input[name="email"]', email, { timeout: 15000 });
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 }), page.click('button[type="submit"]')]);
} catch {
  console.error(`ログインできませんでした（${page.url()}）。メールアドレス・パスワードと、${base} に届くかを確かめてください。`);
  await browser.close();
  process.exit(2);
}
if (page.url().includes("/settings/passkey")) {
  // 顔認証のおすすめ画面は飛ばす
  await page.goto(`${base}/today`);
}
console.log(`ログイン：OK（${page.url().replace(base, "")}）`);

// 2. 画面を順に開く
const rows = [];
const links = new Set();
for (const path of PAGES) {
  const t0 = Date.now();
  const res = await page.goto(base + path, { waitUntil: "load", timeout: 30000 }).catch((e) => {
    problems.push(`[${path}] 開けない: ${e.message.slice(0, 100)}`);
    return null;
  });
  const ms = Date.now() - t0;
  const status = res?.status() ?? 0;
  const final = page.url().replace(base, "");
  const fcp = await page
    .evaluate(() => Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? -1))
    .catch(() => -1);
  const buttons = await page.$$eval("button:not([disabled]), a[href]", (els) => els.filter((el) => el.offsetParent !== null).length).catch(() => 0);
  for (const href of await page.$$eval("a[href^='/']", (as) => as.map((a) => a.getAttribute("href"))).catch(() => [])) {
    if (href && !href.startsWith("/api/")) links.add(href.split("#")[0]);
  }
  if (status >= 400) problems.push(`[${path}] HTTP ${status}`);
  if (final.startsWith("/login")) problems.push(`[${path}] ログイン画面に戻された`);
  rows.push({ path, status, final, ms, fcp, buttons });
}

// 3. 管理画面のカード・ボタンを押して、それぞれの画面が開くか
await page.goto(`${base}/kanri`, { waitUntil: "load" });
const cardHrefs = await page.$$eval("main a[href^='/']", (as) => [...new Set(as.map((a) => a.getAttribute("href")))]).catch(() => []);
for (const href of cardHrefs) {
  await page.goto(`${base}/kanri`, { waitUntil: "load" });
  const link = page.locator(`main a[href="${href}"]`).first();
  if (!(await link.isVisible().catch(() => false))) continue;
  await Promise.all([page.waitForLoadState("load"), link.click()]).catch((e) => problems.push(`[管理画面] ${href} を押せない: ${e.message.slice(0, 80)}`));
  const landed = page.url().replace(base, "");
  if (landed.startsWith("/login") || landed === "/kanri") problems.push(`[管理画面] ${href} を押しても移動しない（${landed}）`);
}

// 4. 集めた内部リンクが 404 / 500 にならないか（Cookie 付きで確認）
const cookies = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
const broken = [];
for (const href of links) {
  const r = await fetch(base + href, { headers: { cookie: cookies }, redirect: "manual" }).catch(() => null);
  if (!r || r.status >= 400) broken.push(`${href} → ${r?.status ?? "通信エラー"}`);
}

await browser.close();

console.log("\n画面                 状態  表示まで  全体     ボタン");
for (const r of rows) {
  console.log(
    `${r.path.padEnd(20)} ${String(r.status).padEnd(5)} ${String(r.fcp).padStart(5)}ms ${String(r.ms).padStart(6)}ms  ${r.buttons}` +
      (r.final !== r.path ? `  → ${r.final}` : ""),
  );
}
const slow = rows.filter((r) => r.ms > 3000);
console.log(`\n管理画面のカード・ボタン：${cardHrefs.length} 個を押した`);
console.log(`内部リンク：${links.size} 件を確認、壊れたリンク ${broken.length} 件`);
broken.forEach((b) => console.log(`  壊れたリンク ${b}`));
console.log(`3秒より遅い画面：${slow.length} 件${slow.length ? "（" + slow.map((r) => r.path).join("、") + "）" : ""}`);
console.log(`問題：${problems.length} 件`);
problems.forEach((p) => console.log(`  ${p}`));
process.exit(problems.length || broken.length ? 1 : 0);
