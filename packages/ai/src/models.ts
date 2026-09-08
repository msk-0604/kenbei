export type AiModelTier = "light" | "default" | "reasoning";

const FALLBACK_MODEL = "gpt-4o-mini";

function firstNonEmpty(...values: (string | undefined)[]): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return FALLBACK_MODEL;
}

/** Resolve chat model from env. Unknown names are not invented; empty env uses gpt-4o-mini. */
export function resolveAiModel(
  tier: AiModelTier,
  env: Record<string, string | undefined>,
): string {
  const shared = env.KENBEI_AI_MODEL_DEFAULT;
  if (tier === "light") {
    return firstNonEmpty(env.KENBEI_AI_MODEL_LIGHT, shared);
  }
  if (tier === "reasoning") {
    return firstNonEmpty(env.KENBEI_AI_MODEL_REASONING, shared);
  }
  return firstNonEmpty(shared);
}

export function defaultAiModelFallback(): string {
  return FALLBACK_MODEL;
}
