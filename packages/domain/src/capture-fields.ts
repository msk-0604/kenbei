export const MVP_CAPTURE_FIELD_KEYS = [
  "work_type",
  "work_description",
  "material",
  "quantity",
  "unit",
  "location",
  "issue",
  "next_action",
  "note",
] as const;

export type MvpCaptureFieldKey = (typeof MVP_CAPTURE_FIELD_KEYS)[number];

export const DEFAULT_AUTO_ACCEPT_THRESHOLD = 0.9;

export const FIELD_LABELS: Record<MvpCaptureFieldKey, string> = {
  work_type: "工種",
  work_description: "作業",
  material: "材料",
  quantity: "数量",
  unit: "単位",
  location: "場所",
  issue: "問題",
  next_action: "次の作業",
  note: "メモ",
};

export function isMvpCaptureFieldKey(value: string): value is MvpCaptureFieldKey {
  return (MVP_CAPTURE_FIELD_KEYS as readonly string[]).includes(value);
}

export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatFieldValue(item)).join("、");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.code === "string") {
      const qty = record.quantity ?? record.qty;
      const unit = record.unit;
      return [record.code, qty, unit].filter((part) => part !== undefined && part !== null).join(" ");
    }
    return Object.values(record)
      .filter((part) => part !== undefined && part !== null)
      .map((part) => formatFieldValue(part))
      .join(" ");
  }
  return "";
}

export function confirmationQuestion(fieldKey: string, proposedValue: unknown): string {
  const label = isMvpCaptureFieldKey(fieldKey) ? FIELD_LABELS[fieldKey] : fieldKey;
  const formatted = formatFieldValue(proposedValue);
  if (fieldKey === "material" || fieldKey === "quantity" || fieldKey === "unit") {
    return `${formatted} で合っていますか？`;
  }
  return `${label}は「${formatted}」で合っていますか？`;
}

export function needsHumanConfirm(confidence: number, threshold = DEFAULT_AUTO_ACCEPT_THRESHOLD): boolean {
  return confidence < threshold;
}
