const TECHNICAL =
  /failed to|postgrest|pgrst|jwt|permission denied|column|violates|networkerror|fetch failed|timeout|typeerror|undefined|null is not|internal server|sql|supabase|stripe|stack/i;

const HAS_JP = /[\u3040-\u30ff\u4e00-\u9faf]/;

export function toUserActionError(raw: string | null | undefined, action: string): string {
  const next = "通信状況を確認して、もう一度押してください。";
  const fallback = `${action}できませんでした。${next}`;
  if (!raw?.trim()) {
    return fallback;
  }
  const text = raw.trim();
  if (TECHNICAL.test(text) || !HAS_JP.test(text)) {
    return fallback;
  }
  if (text.length > 120) {
    return fallback;
  }
  return text.endsWith("。") ? text : `${text}。`;
}
