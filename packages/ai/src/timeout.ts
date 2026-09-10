export const DEFAULT_AI_TIMEOUT_MS = 25_000;
export const MIN_AI_TIMEOUT_MS = 3_000;
export const MAX_AI_TIMEOUT_MS = 120_000;

export const AI_TIMEOUT_USER_MESSAGE =
  "AIの応答が時間切れになりました。もう一度お試しください。";

export class AiTimeoutError extends Error {
  readonly code = "AI_TIMEOUT" as const;

  constructor(message = AI_TIMEOUT_USER_MESSAGE) {
    super(message);
    this.name = "AiTimeoutError";
  }
}

function processEnv(): { KENBEI_AI_TIMEOUT_MS?: string } {
  const proc = (globalThis as { process?: { env?: { KENBEI_AI_TIMEOUT_MS?: string } } }).process;
  return proc?.env ?? {};
}

export function aiTimeoutMs(env: { KENBEI_AI_TIMEOUT_MS?: string } = processEnv()): number {
  const raw = Number(env.KENBEI_AI_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw >= MIN_AI_TIMEOUT_MS && raw <= MAX_AI_TIMEOUT_MS) {
    return Math.floor(raw);
  }
  return DEFAULT_AI_TIMEOUT_MS;
}

export function isAiTimeoutError(error: unknown): boolean {
  if (error instanceof AiTimeoutError) {
    return true;
  }
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

export function warnAiCallFailure(
  kind: "timeout" | "http" | "network",
  extra: Record<string, unknown> = {},
): void {
  console.warn(
    JSON.stringify({
      level: "warn",
      message: kind === "timeout" ? "ai.timeout" : "ai.error",
      kind,
      ...extra,
    }),
  );
}

export async function fetchWithAiTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = aiTimeoutMs(),
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal =
    init.signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal;
  try {
    return await fetch(url, { ...init, signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AiTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
