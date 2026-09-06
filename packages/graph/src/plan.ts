import {
  resolvedCaptureValue,
  type CaptureFieldRecord,
  type JsonValue,
} from "@kensapo/domain";
import type { ConfirmedCapture } from "./types";

export type GraphWrite =
  | {
      kind: "work_event";
      workTypeKey: string | null;
      workDescription: string | null;
      location: string | null;
      issue: string | null;
      nextAction: string | null;
      note: string | null;
    }
  | {
      kind: "material_usage";
      materialCode: string;
      quantity: number;
      unit: string | null;
    }
  | {
      kind: "incident";
      title: string;
      action: string | null;
    }
  | {
      kind: "work_type";
      workTypeKey: string;
    };

function asString(value: JsonValue | null): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function asNumber(value: JsonValue | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function fieldMap(fields: CaptureFieldRecord[]): Map<string, JsonValue> {
  const map = new Map<string, JsonValue>();
  for (const field of fields) {
    const value = resolvedCaptureValue(field);
    if (value !== null) {
      map.set(field.fieldKey, value);
    }
  }
  return map;
}

/** Only confirmed / auto_accepted / corrected values. Pending is ignored. */
export function planConfirmedCaptureWrites(input: ConfirmedCapture): GraphWrite[] {
  const values = fieldMap(input.fields);
  const writes: GraphWrite[] = [];
  const workType = asString(values.get("work_type") ?? null);
  const description = asString(values.get("work_description") ?? null);
  const location = asString(values.get("location") ?? null);
  const issue = asString(values.get("issue") ?? null);
  const nextAction = asString(values.get("next_action") ?? null);
  const note = asString(values.get("note") ?? null);

  if (workType || description || location || issue || nextAction || note) {
    writes.push({
      kind: "work_event",
      workTypeKey: workType,
      workDescription: description,
      location,
      issue,
      nextAction,
      note,
    });
  }

  if (workType) {
    writes.push({ kind: "work_type", workTypeKey: workType });
  }

  const material = values.get("material");
  let materialCode = asString(material ?? null);
  let quantity = asNumber(values.get("quantity") ?? null);
  let unit = asString(values.get("unit") ?? null);
  if (material && typeof material === "object" && !Array.isArray(material)) {
    const record = material as { [key: string]: JsonValue };
    materialCode = asString(record.code ?? record.material ?? null) ?? materialCode;
    quantity = asNumber(record.quantity ?? record.qty ?? null) ?? quantity;
    unit = asString(record.unit ?? null) ?? unit;
  }
  if (materialCode && quantity !== null) {
    writes.push({
      kind: "material_usage",
      materialCode,
      quantity,
      unit,
    });
  }

  if (issue) {
    writes.push({ kind: "incident", title: issue, action: nextAction });
  }

  return writes;
}
