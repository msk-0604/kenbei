/**
 * AI が分からないときに返す「不明」「未定」のような言葉は、写真の分類として残さない
 * （写真の一覧に「建設 不明」と出てしまうため）。
 */
const PLACEHOLDER_LABELS = new Set([
  "不明",
  "未定",
  "なし",
  "無し",
  "不詳",
  "特定不可",
  "判別不可",
  "建設",
  "建設現場",
  "施工",
  "unknown",
  "none",
  "n/a",
  "-",
  "—",
  "－",
]);

export function cleanPhotoLabel(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  if (!text || PLACEHOLDER_LABELS.has(text.toLowerCase())) {
    return undefined;
  }
  return text;
}
