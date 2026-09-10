import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(resolve(root, "supabase/tests/rls_organization_isolation.sql"), "utf8");

try {
  execFileSync("npx", ["supabase", "db", "start"], { cwd: root, stdio: "inherit" });
} catch {
  // already running is fine; query will fail loudly if DB is missing
}

execFileSync("npx", ["supabase", "db", "query", "--local", sql], {
  cwd: root,
  stdio: "inherit",
});
console.log("RLS tenant isolation SQL passed.");
