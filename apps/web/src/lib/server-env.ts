/** Runtime read. Avoid `process.env.NAME` so Next.js does not inline empty build values. */
export function readServerEnv(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}
