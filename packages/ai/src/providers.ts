import {
  AI_PROCESSING_VERSION,
  type AiProviderName,
  type AiService,
  type CaptureContext,
  type DailyReportDraftInput,
  type DailyReportDraftResult,
  type PhotoClassification,
  type StructureCaptureResult,
  type StructuredField,
  type TranscriptionInput,
  type TranscriptionResult,
} from "./contract";
import { structureTranscriptHeuristic } from "./heuristic";
import { classifyPhotoHeuristic } from "./photo-heuristic";
import { draftDailyReportTemplate } from "./report-draft";
import { classifyPhotoWithOpenAiVision, draftDailyReportWithOpenAi } from "./vision-draft";

export type HttpAiConfig = {
  apiKey: string;
};

function asFields(value: unknown): StructuredField<unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const fields: StructuredField<unknown>[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (typeof record.key !== "string") {
      continue;
    }
    const confidence = typeof record.confidence === "number" ? record.confidence : 0.5;
    fields.push({
      key: record.key,
      value: record.value,
      confidence,
      needsConfirmation: record.needsConfirmation === true || confidence < 0.9,
    });
  }
  return fields;
}

function audioBlob(input: TranscriptionInput): Blob {
  const bytes = input.audioBytes ?? new Uint8Array();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: input.mimeType || "audio/webm" });
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return globalThis.btoa(binary);
}

export class OpenAiService implements AiService {
  constructor(private readonly config: HttpAiConfig) {}

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const body = new FormData();
    body.set("model", "whisper-1");
    body.set("language", "ja");
    body.append("file", audioBlob(input), input.fileName ?? "capture.webm");
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      body,
    });
    if (!response.ok) {
      throw new Error(`OpenAI transcription failed: ${response.status}`);
    }
    const json = (await response.json()) as { text?: string };
    return {
      text: json.text ?? "",
      provider: "openai",
      model: "whisper-1",
      processingVersion: AI_PROCESSING_VERSION,
    };
  }

  async structureCapture(
    transcript: string,
    context: CaptureContext,
  ): Promise<StructureCaptureResult> {
    const heuristic = structureTranscriptHeuristic(transcript, context);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "建設現場の報告から JSON だけ返す。keys: fields[{key,value,confidence,needsConfirmation}]. key は work_type, work_description, material, quantity, unit, location, issue, next_action, note のみ。確定はしない。",
          },
          { role: "user", content: transcript },
        ],
      }),
    });
    if (!response.ok) {
      return wrap("openai", "gpt-4o-mini", heuristic, { fallback: "heuristic", transcript });
    }
    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      return wrap("openai", "gpt-4o-mini", heuristic, { fallback: "heuristic", transcript });
    }
    try {
      const parsed = JSON.parse(content) as { fields?: unknown };
      const llmFields = asFields(parsed.fields);
      const merged = llmFields.length > 0 ? llmFields : heuristic;
      return wrap("openai", "gpt-4o-mini", merged, parsed);
    } catch {
      return wrap("openai", "gpt-4o-mini", heuristic, { fallback: "heuristic", transcript });
    }
  }

  async classifyPhoto(input: {
    storagePath: string;
    fileName?: string;
    mimeType?: string;
    imageBase64?: string;
    context: CaptureContext;
  }): Promise<PhotoClassification> {
    const fallback = classifyPhotoHeuristic(input.fileName);
    return classifyPhotoWithOpenAiVision({
      apiKey: this.config.apiKey,
      fileName: input.fileName,
      mimeType: input.mimeType,
      imageBase64: input.imageBase64,
      fallback,
    });
  }

  async draftDailyReport(input: DailyReportDraftInput): Promise<DailyReportDraftResult> {
    const template = draftDailyReportTemplate(input);
    const polished = await draftDailyReportWithOpenAi({
      apiKey: this.config.apiKey,
      projectName: input.projectName,
      workOn: input.workOn,
      authorName: input.authorName,
      photoNotes: input.photoNotes,
      taskNotes: input.taskNotes,
      progressNote: input.progressNote,
      workSummary: input.workSummary,
      weather: input.weather,
      fallbackBody: template.body,
    });
    return {
      body: polished.body,
      progressNote: polished.progressNote ?? template.progressNote,
      issues: polished.issues ?? template.issues,
      safetyNotes: polished.safetyNotes ?? template.safetyNotes,
      tomorrowPlan: polished.tomorrowPlan ?? template.tomorrowPlan,
      provider: "openai",
      model: "gpt-4o-mini",
    };
  }

  async parseDocument(): Promise<{ text: string; fields: never[] }> {
    return { text: "", fields: [] };
  }

  async summarize(text: string, purpose: "report" | "incident" | "lesson" = "report"): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "日本語で簡潔に要約する。与えられた事実以外は書かない。承認・削除・課金・メンバー変更は提案しない。確認用の下書き。purpose=" +
              purpose,
          },
          { role: "user", content: text },
        ],
      }),
    });
    if (!response.ok) {
      return text;
    }
    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() || text;
  }

  async extractCautions(): Promise<never[]> {
    return [];
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => []);
  }
}

export class GeminiAiService implements AiService {
  constructor(private readonly config: HttpAiConfig) {}

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const bytes = input.audioBytes ?? new Uint8Array();
    const b64 = uint8ToBase64(bytes);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.config.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: "この音声を日本語で文字起こししてください。本文だけ返す。" },
                { inline_data: { mime_type: input.mimeType || "audio/webm", data: b64 } },
              ],
            },
          ],
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Gemini transcription failed: ${response.status}`);
    }
    const json = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return {
      text,
      provider: "gemini",
      model: "gemini-2.0-flash",
      processingVersion: AI_PROCESSING_VERSION,
    };
  }

  async structureCapture(
    transcript: string,
    context: CaptureContext,
  ): Promise<StructureCaptureResult> {
    const heuristic = structureTranscriptHeuristic(transcript, context);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.config.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `建設現場の報告を JSON で。{"fields":[{"key":"work_type","value":"","confidence":0.8,"needsConfirmation":true}]}。key は work_type, work_description, material, quantity, unit, location, issue, next_action, note。本文:\n${transcript}`,
                },
              ],
            },
          ],
        }),
      },
    );
    if (!response.ok) {
      return wrap("gemini", "gemini-2.0-flash", heuristic, { fallback: "heuristic" });
    }
    const json = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return wrap("gemini", "gemini-2.0-flash", heuristic, { fallback: "heuristic" });
    }
    try {
      const parsed = JSON.parse(match[0]) as { fields?: unknown };
      const llmFields = asFields(parsed.fields);
      return wrap("gemini", "gemini-2.0-flash", llmFields.length > 0 ? llmFields : heuristic, parsed);
    } catch {
      return wrap("gemini", "gemini-2.0-flash", heuristic, { fallback: "heuristic" });
    }
  }

  async classifyPhoto(input: {
    fileName?: string;
    mimeType?: string;
    imageBase64?: string;
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

export class AnthropicAiService implements AiService {
  constructor(
    private readonly config: HttpAiConfig,
    private readonly transcribeFallback: AiService,
  ) {}

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    return this.transcribeFallback.transcribe(input);
  }

  async structureCapture(
    transcript: string,
    context: CaptureContext,
  ): Promise<StructureCaptureResult> {
    const heuristic = structureTranscriptHeuristic(transcript, context);
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `建設現場の報告を JSON だけ。{"fields":[{"key":"work_type","value":"","confidence":0.8,"needsConfirmation":true}]}。key は work_type, work_description, material, quantity, unit, location, issue, next_action, note。\n${transcript}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      return wrap("anthropic", "claude-3-5-haiku-latest", heuristic, { fallback: "heuristic" });
    }
    const json = (await response.json()) as { content?: { text?: string }[] };
    const text = json.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return wrap("anthropic", "claude-3-5-haiku-latest", heuristic, { fallback: "heuristic" });
    }
    try {
      const parsed = JSON.parse(match[0]) as { fields?: unknown };
      const llmFields = asFields(parsed.fields);
      return wrap(
        "anthropic",
        "claude-3-5-haiku-latest",
        llmFields.length > 0 ? llmFields : heuristic,
        parsed,
      );
    } catch {
      return wrap("anthropic", "claude-3-5-haiku-latest", heuristic, { fallback: "heuristic" });
    }
  }

  async classifyPhoto(input: {
    fileName?: string;
    mimeType?: string;
    imageBase64?: string;
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

function wrap(
  provider: AiProviderName,
  model: string,
  fields: StructuredField<unknown>[],
  rawExtraction: unknown,
): StructureCaptureResult {
  return {
    fields,
    rawExtraction,
    provider,
    model,
    processingVersion: AI_PROCESSING_VERSION,
  };
}
