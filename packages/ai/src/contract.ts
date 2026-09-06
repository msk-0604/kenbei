export type AiProviderName = "openai" | "gemini" | "anthropic" | "null";

export type Confidence = number;

export type StructuredField<T> = {
  key: string;
  value: T;
  confidence: Confidence;
  needsConfirmation: boolean;
};

export type TranscriptionInput = {
  organizationId: string;
  mimeType: string;
  storagePath: string;
  fileName?: string;
  audioBytes?: Uint8Array;
};

export type CaptureContext = {
  organizationId: string;
  projectId?: string;
  workOn: string;
  knownWorkerNames: string[];
  knownMaterialCodes: string[];
  knownLocationHints: string[];
  currentProcessNames: string[];
};

export type TranscriptionResult = {
  text: string;
  provider: AiProviderName;
  model: string;
  processingVersion: string;
};

export type StructureCaptureResult = {
  fields: StructuredField<unknown>[];
  rawExtraction: unknown;
  provider: AiProviderName;
  model: string;
  processingVersion: string;
};

/**
 * UI must never import a provider SDK. Call this only from BFF / jobs.
 * Cost, margin, schedule, authz, and CRUD stay in @kensapo/domain.
 */
export type PhotoClassification = {
  categoryKey: string;
  workType?: string;
  locationText?: string;
  locationSpot?: string;
  floor?: string;
  area?: string;
  description?: string;
  tags: string[];
  confidence: Confidence;
};

export type DailyReportDraftInput = {
  projectName: string;
  workOn: string;
  authorName: string;
  photoNotes: string[];
  taskNotes: string[];
  progressNote?: string;
  workSummary?: string;
  weather?: string;
  similarHints?: string[];
};

export type DailyReportDraftResult = {
  body: string;
  workLocation?: string;
  issues?: string;
  safetyNotes?: string;
  tomorrowPlan?: string;
  progressNote?: string;
  provider: AiProviderName;
  model: string;
};

export interface AiService {
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
  structureCapture(
    transcript: string,
    context: CaptureContext,
  ): Promise<StructureCaptureResult>;
  classifyPhoto(input: {
    storagePath: string;
    fileName?: string;
    mimeType?: string;
    imageBase64?: string;
    context: CaptureContext;
  }): Promise<PhotoClassification>;
  draftDailyReport(input: DailyReportDraftInput): Promise<DailyReportDraftResult>;
  parseDocument(input: {
    storagePath: string;
    mimeType: string;
  }): Promise<{ text: string; fields: StructuredField<unknown>[] }>;
  summarize(text: string, purpose: "report" | "incident" | "lesson"): Promise<string>;
  extractCautions(text: string): Promise<{ body: string; confidence: Confidence }[]>;
  embed(texts: string[]): Promise<number[][]>;
}

export const AI_PROCESSING_VERSION = "capture-structure.v1";
