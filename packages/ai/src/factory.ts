import type { AiProviderName, AiService } from "./contract";
import { MockAiService } from "./mock-service";
import { AnthropicAiService, GeminiAiService, OpenAiService } from "./providers";

export type AiServiceOptions = {
  provider?: AiProviderName | string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  anthropicApiKey?: string;
};

function firstAvailable(options: AiServiceOptions): AiProviderName {
  const requested = (options.provider ?? "auto").toLowerCase();
  if (requested === "openai" && options.openaiApiKey) {
    return "openai";
  }
  if (requested === "gemini" && options.geminiApiKey) {
    return "gemini";
  }
  if (requested === "anthropic" && options.anthropicApiKey) {
    return "anthropic";
  }
  if (requested === "null" || requested === "mock") {
    return "null";
  }
  if (options.openaiApiKey) {
    return "openai";
  }
  if (options.geminiApiKey) {
    return "gemini";
  }
  if (options.anthropicApiKey) {
    return "anthropic";
  }
  return "null";
}

/**
 * Call from the server only. Missing keys fall back to MockAiService.
 */
export function createAiService(options: AiServiceOptions = {}): AiService {
  const provider = firstAvailable(options);
  switch (provider) {
    case "openai":
      return new OpenAiService({ apiKey: options.openaiApiKey ?? "" });
    case "gemini":
      return new GeminiAiService({ apiKey: options.geminiApiKey ?? "" });
    case "anthropic":
      return new AnthropicAiService({ apiKey: options.anthropicApiKey ?? "" }, new MockAiService());
    default:
      return new MockAiService();
  }
}
