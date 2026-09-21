export function isCronAuthorized(
  headers: { get(name: string): string | null },
  secret: string | undefined,
): boolean {
  if (!secret) {
    return false;
  }
  const bearer = headers.get("authorization");
  const headerSecret = headers.get("x-cron-secret");
  return bearer === `Bearer ${secret}` || headerSecret === secret;
}
