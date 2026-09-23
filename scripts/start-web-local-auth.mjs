import { execFileSync, spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
if (!envMap.ANON_KEY?.startsWith("eyJ") || !envMap.SERVICE_ROLE_KEY?.startsWith("eyJ")) {
  console.error("local supabase keys missing");
  process.exit(1);
}

const port = process.env.KENBEI_LOCAL_WEB_PORT || "3000";
const child = spawn("pnpm", ["--filter", "@kensapo/web", "exec", "next", "dev", "--turbopack", "-p", port], {
  cwd: root,
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: envMap.ANON_KEY,
    NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
    SUPABASE_SERVICE_ROLE_KEY: envMap.SERVICE_ROLE_KEY,
    KENBEI_ENV: "local",
  },
  stdio: "inherit",
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 1));
