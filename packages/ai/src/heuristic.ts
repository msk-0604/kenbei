import type { CaptureContext, StructuredField } from "./contract";

export const DEMO_TRANSCRIPT =
  "今日は3階の給水配管。HI25を12本使用。16時終了。明日続きを行います。";

const WORK_TYPES: { key: string; name: string }[] = [
  { key: "plumbing", name: "給排水" },
  { key: "sanitary", name: "衛生" },
  { key: "electrical", name: "電気" },
  { key: "hvac", name: "空調" },
  { key: "fire_protection", name: "消防" },
  { key: "interior", name: "内装" },
  { key: "painting", name: "塗装" },
  { key: "waterproofing", name: "防水" },
  { key: "civil", name: "土木" },
];

function field(
  key: string,
  value: unknown,
  confidence: number,
): StructuredField<unknown> {
  return {
    key,
    value,
    confidence,
    needsConfirmation: confidence < 0.9,
  };
}

export function structureTranscriptHeuristic(
  transcript: string,
  context: CaptureContext,
): StructuredField<unknown>[] {
  const fields: StructuredField<unknown>[] = [];
  const text = transcript.replace(/\s+/g, "");

  const workType = WORK_TYPES.find((item) => text.includes(item.name.replace("給排水", "給水")) || text.includes(item.name));
  const plumbing = /給水|排水|配管/.test(text);
  if (workType) {
    fields.push(field("work_type", workType.name, 0.93));
  } else if (plumbing) {
    fields.push(field("work_type", "給排水", 0.91));
  }

  const workMatch = text.match(/((?:給水)?配管|衛生|電気|空調|消防|内装|塗装|防水|土木)([^。]*)?/);
  if (plumbing) {
    fields.push(field("work_description", "給水配管", 0.9));
  } else if (workMatch?.[1]) {
    fields.push(field("work_description", workMatch[1], 0.82));
  }

  const floor = text.match(/(\d+)\s*階/);
  if (floor?.[1]) {
    fields.push(field("location", `${floor[1]}階`, 0.92));
  } else if (context.knownLocationHints[0]) {
    fields.push(field("location", context.knownLocationHints[0], 0.55));
  }

  const material = text.match(/([A-Za-z]{1,4}\d{2,})\s*(?:を)?\s*(\d+)\s*(本|個|m|メートル|袋)?/);
  if (material?.[1] && material[2]) {
    const unit = material[3] ?? "本";
    const known = context.knownMaterialCodes.includes(material[1].toUpperCase());
    fields.push(field("material", material[1].toUpperCase(), known ? 0.95 : 0.88));
    fields.push(field("quantity", Number(material[2]), 0.93));
    fields.push(field("unit", unit === "メートル" ? "m" : unit, 0.9));
  }

  if (/明日/.test(text)) {
    fields.push(field("next_action", "続き", 0.8));
  }

  const issue = text.match(/(漏水|破損|手戻り|クレーム|トラブル)([^。]*)?/);
  if (issue?.[1]) {
    fields.push(field("issue", issue[0], 0.7));
  }

  if (transcript.trim().length > 0) {
    fields.push(field("note", transcript.trim(), 0.86));
  }

  return fields;
}
