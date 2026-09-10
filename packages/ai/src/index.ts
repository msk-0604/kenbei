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
export {
  AI_TIMEOUT_USER_MESSAGE,
  AiTimeoutError,
  DEFAULT_AI_TIMEOUT_MS,
  aiTimeoutMs,
  fetchWithAiTimeout,
  isAiTimeoutError,
  warnAiCallFailure,
} from "./timeout";
export { resolveAiModel, defaultAiModelFallback } from "./models";
export type { AiModelTier } from "./models";
export {
  OPENAI_STRATEGIST_TOOLS,
  STRATEGIST_TOOLS,
  STRATEGIST_TOOL_LEVEL_1,
  STRATEGIST_TOOL_LEVEL_2,
  isAllowedStrategistTool,
  isBlockedStrategistTool,
  parseToolUuid,
  routeStrategistHeuristically,
  sanitizeStrategistToolArgs,
  strategistSystemPrompt,
} from "./agent-policy";
export type { HeuristicRoute, StrategistToolName } from "./agent-policy";
