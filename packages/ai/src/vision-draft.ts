import type { PhotoClassification } from "./contract";
import { fetchWithAiTimeout, isAiTimeoutError, warnAiCallFailure } from "./timeout";

function asClassification(value: unknown, fallback: PhotoClassification): PhotoClassification {
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const record = value as Record<string, unknown>;
  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 8)
    : fallback.tags;
  const confidence = typeof record.confidence === "number" ? record.confidence : fallback.confidence;
  return {
    categoryKey: typeof record.categoryKey === "string" ? record.categoryKey : fallback.categoryKey,
    workType: typeof record.workType === "string" ? record.workType : fallback.workType,
    locationSpot: typeof record.locationSpot === "string" ? record.locationSpot : fallback.locationSpot,
    floor: typeof record.floor === "string" ? record.floor : fallback.floor,
    area: typeof record.area === "string" ? record.area : fallback.area,
    description: typeof record.description === "string" ? record.description : fallback.description,
    tags: tags.length > 0 ? tags : fallback.tags,
    confidence: Math.min(1, Math.max(0, confidence)),
  };
}

export async function classifyPhotoWithOpenAiVision(input: {
  apiKey: string;
  fileName?: string;
  mimeType?: string;
  imageBase64?: string;
  fallback: PhotoClassification;
}): Promise<PhotoClassification> {
  if (!input.imageBase64) {
    return input.fallback;
  }
  let response: Response | null = null;
  try {
    response = await fetchWithAiTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "建設現場の施工写真を見て JSON だけ返す。keys: categoryKey, workType, locationSpot, floor, area, description, tags[], confidence(0-1)。確定判断はしない。候補のみ。日本語。",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `ファイル名: ${input.fileName ?? "unknown"}。工種・施工箇所・階・短い説明・タグを推定せよ。`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${input.mimeType || "image/jpeg"};base64,${input.imageBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });
  } catch (error) {
    warnAiCallFailure(isAiTimeoutError(error) ? "timeout" : "network", {
      provider: "openai",
      op: "classifyPhoto",
    });
    return input.fallback;
  }
  if (!response.ok) {
    warnAiCallFailure("http", { provider: "openai", op: "classifyPhoto", status: response.status });
    return input.fallback;
  }
  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    return input.fallback;
  }
  try {
    return asClassification(JSON.parse(content), input.fallback);
  } catch {
    return input.fallback;
  }
}

export async function draftDailyReportWithOpenAi(input: {
  apiKey: string;
  projectName: string;
  workOn: string;
  authorName: string;
  photoNotes: string[];
  taskNotes: string[];
  progressNote?: string;
  workSummary?: string;
  weather?: string;
  fallbackBody: string;
}): Promise<{ body: string; progressNote?: string; issues?: string; safetyNotes?: string; tomorrowPlan?: string }> {
  let response: Response | null = null;
  try {
    response = await fetchWithAiTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "日本語の工事日報下書きを作る。JSON keys: body, progressNote, issues, safetyNotes, tomorrowPlan。事実のないことは書かない。確定表現は避け、確認用下書きにする。",
          },
          {
            role: "user",
            content: JSON.stringify({
              projectName: input.projectName,
              workOn: input.workOn,
              authorName: input.authorName,
              photoNotes: input.photoNotes,
              taskNotes: input.taskNotes,
              progressNote: input.progressNote,
              workSummary: input.workSummary,
              weather: input.weather,
              template: input.fallbackBody,
            }),
          },
        ],
      }),
    });
  } catch (error) {
    warnAiCallFailure(isAiTimeoutError(error) ? "timeout" : "network", {
      provider: "openai",
      op: "draftDailyReport",
    });
    return { body: input.fallbackBody };
  }
  if (!response.ok) {
    warnAiCallFailure("http", { provider: "openai", op: "draftDailyReport", status: response.status });
    return { body: input.fallbackBody };
  }
  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    return { body: input.fallbackBody };
  }
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return {
      body: typeof parsed.body === "string" && parsed.body.trim() ? parsed.body : input.fallbackBody,
      progressNote: typeof parsed.progressNote === "string" ? parsed.progressNote : undefined,
      issues: typeof parsed.issues === "string" ? parsed.issues : undefined,
      safetyNotes: typeof parsed.safetyNotes === "string" ? parsed.safetyNotes : undefined,
      tomorrowPlan: typeof parsed.tomorrowPlan === "string" ? parsed.tomorrowPlan : undefined,
    };
  } catch {
    return { body: input.fallbackBody };
  }
}
