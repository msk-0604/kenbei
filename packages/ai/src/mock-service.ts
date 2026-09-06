import {
  AI_PROCESSING_VERSION,
  type AiService,
  type CaptureContext,
  type DailyReportDraftInput,
  type DailyReportDraftResult,
  type PhotoClassification,
  type StructureCaptureResult,
  type TranscriptionInput,
  type TranscriptionResult,
} from "./contract";
import { DEMO_TRANSCRIPT, structureTranscriptHeuristic } from "./heuristic";
import { classifyPhotoHeuristic } from "./photo-heuristic";
import { draftDailyReportTemplate } from "./report-draft";

/**
 * No provider key. Keeps the capture loop runnable.
 * Does not invent confirmed Graph facts — caller still requires Confirm.
 */
export class MockAiService implements AiService {
  async transcribe(_input: TranscriptionInput): Promise<TranscriptionResult> {
    return {
      text: DEMO_TRANSCRIPT,
      provider: "null",
      model: "mock-heuristic",
      processingVersion: AI_PROCESSING_VERSION,
    };
  }

  async structureCapture(
    transcript: string,
    context: CaptureContext,
  ): Promise<StructureCaptureResult> {
    const fields = structureTranscriptHeuristic(transcript, context);
    return {
      fields,
      rawExtraction: { transcript, fields },
      provider: "null",
      model: "mock-heuristic",
      processingVersion: AI_PROCESSING_VERSION,
    };
  }

  async classifyPhoto(input: {
    storagePath: string;
    fileName?: string;
    mimeType?: string;
    imageBase64?: string;
    context: CaptureContext;
  }): Promise<PhotoClassification> {
    return classifyPhotoHeuristic(input.fileName);
  }

  async draftDailyReport(input: DailyReportDraftInput): Promise<DailyReportDraftResult> {
    return draftDailyReportTemplate(input);
  }

  async parseDocument(): Promise<{ text: string; fields: never[] }> {
    return { text: "", fields: [] };
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
