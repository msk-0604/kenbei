import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readCrons(relativePath: string) {
  const json = JSON.parse(readFileSync(resolve(process.cwd(), relativePath), "utf8")) as {
    crons?: { path: string; schedule: string }[];
  };
  return json.crons ?? [];
}

describe("vercel cron schedule", () => {
  it("registers task-deadlines at 07:00 JST in the Vercel app root", () => {
    const web = readCrons("apps/web/vercel.json");
    const root = readCrons("vercel.json");
    expect(web).toEqual([{ path: "/api/cron/task-deadlines", schedule: "0 22 * * *" }]);
    expect(root).toContainEqual({ path: "/api/cron/task-deadlines", schedule: "0 22 * * *" });
  });
});
