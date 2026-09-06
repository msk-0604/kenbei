export type {
  AiProviderName,
  AiService,
  CaptureContext,
  Confidence,
  DailyReportDraftInput,
  DailyReportDraftResult,
  PhotoClassification,
  StructureCaptureResult,
  StructuredField,
  TranscriptionInput,
  TranscriptionResult,
} from "./contract";
export { AI_PROCESSING_VERSION } from "./contract";
export { NullAiService, AiNotConfiguredError } from "./null-service";
export { MockAiService } from "./mock-service";
export { createAiService } from "./factory";
export type { AiServiceOptions } from "./factory";
export { DEMO_TRANSCRIPT, structureTranscriptHeuristic } from "./heuristic";
export { classifyPhotoHeuristic } from "./photo-heuristic";
export { draftDailyReportTemplate } from "./report-draft";
export {
  briefChatSummary,
  briefDelayRisk,
  briefProjectSummary,
  briefWeeklySummary,
  photoAssistFromFilename,
  proposeTaskTitles,
} from "./ops-briefs";
export type { OpsBriefFacts } from "./ops-briefs";
