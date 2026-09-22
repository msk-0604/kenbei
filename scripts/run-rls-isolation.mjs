import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { platform } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(resolve(root, "supabase/tests/rls_organization_isolation.sql"), "utf8");
const npx = platform() === "win32" ? "npx.cmd" : "npx";

try {
  execFileSync(npx, ["supabase", "db", "start"], {
    cwd: root,
    stdio: "inherit",
    shell: platform() === "win32",
  });
} catch {
  // already running is fine; query will fail loudly if DB is missing
}

execFileSync(
  "docker",
  ["exec", "-i", "supabase_db_kensapo", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
  {
    cwd: root,
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
  },
);
console.log("RLS tenant isolation SQL passed.");
