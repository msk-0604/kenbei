import { AI_PROCESSING_VERSION, type AiService, type DailyReportDraftInput } from "./contract";
import { classifyPhotoHeuristic } from "./photo-heuristic";
import { draftDailyReportTemplate } from "./report-draft";

/** Tests and phases 1-6 use this. No network, no provider keys. */
export class NullAiService implements AiService {
  async transcribe(): Promise<never> {
    throw new AiNotConfiguredError("transcribe");
  }

  async structureCapture(): Promise<never> {
    throw new AiNotConfiguredError("structureCapture");
  }

  async classifyPhoto(input: { fileName?: string; mimeType?: string; imageBase64?: string }) {
    return classifyPhotoHeuristic(input.fileName);
  }

  async draftDailyReport(input: DailyReportDraftInput) {
    return draftDailyReportTemplate(input);
  }

  async parseDocument(): Promise<never> {
    throw new AiNotConfiguredError("parseDocument");
  }

  async summarize(text: string): Promise<string> {
    return text;
  }

  async extractCautions(): Promise<never[]> {
    return [];
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => []);
  }
}

export class AiNotConfiguredError extends Error {
  readonly code = "ai_not_configured" as const;

  constructor(operation: string) {
    super(`AI provider is not configured for ${operation} (version ${AI_PROCESSING_VERSION})`);
    this.name = "AiNotConfiguredError";
  }
}
