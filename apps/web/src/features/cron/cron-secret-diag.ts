export const CRON_DIAG_HEADER = "x-cron-diag";

export type CronSecretDiag = {
  exists: boolean;
  trim_length: number;
  authorization_present: boolean;
  bearer_prefix_ok: boolean;
  lengths_equal: boolean;
  exact_match: boolean;
};

export function isCronDiagRequest(headers: { get(name: string): string | null }): boolean {
  return headers.get(CRON_DIAG_HEADER)?.trim() === "1";
}

/** Shape-only. Never include secret or header values. */
export function diagnoseCronSecret(
  headers: { get(name: string): string | null },
  rawEnv: string | undefined,
): CronSecretDiag {
  const exists = typeof rawEnv === "string";
  const secret = exists ? rawEnv.trim() : "";
  const authorization = headers.get("authorization");
  const authorization_present = typeof authorization === "string" && authorization.length > 0;
  const bearer_prefix_ok = typeof authorization === "string" && authorization.startsWith("Bearer ");
  const token = bearer_prefix_ok ? authorization.slice("Bearer ".length) : "";
  const headerSecret = headers.get("x-cron-secret");
  const lengths_equal = bearer_prefix_ok && token.length === secret.length;
  const exact_match =
    Boolean(secret) && (authorization === `Bearer ${secret}` || headerSecret === secret);
  return {
    exists,
    trim_length: secret.length,
    authorization_present,
    bearer_prefix_ok,
    lengths_equal,
    exact_match,
  };
}
