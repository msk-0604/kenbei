/**
 * Capture field values keep AI proposal and human correction separate.
 * Graph apply uses confirmedValue only.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type CaptureFieldRecord = {
  fieldKey: string;
  confidence: number;
  proposedValue: JsonValue;
  correctedValue: JsonValue | null;
  confirmedValue: JsonValue | null;
  status: "pending" | "auto_accepted" | "confirmed" | "corrected" | "rejected";
  confirmedBy: string | null;
  confirmedAt: string | null;
};

export function resolvedCaptureValue(field: CaptureFieldRecord): JsonValue | null {
  if (field.status === "rejected") {
    return null;
  }
  if (field.confirmedValue !== null) {
    return field.confirmedValue;
  }
  if (field.status === "auto_accepted") {
    return field.proposedValue;
  }
  return null;
}
