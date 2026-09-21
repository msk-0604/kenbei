import { addDaysIso } from "./ops";

export const REPORT_WEATHER_OPTIONS = [
  { value: "晴れ", emoji: "☀️" },
  { value: "くもり", emoji: "☁️" },
  { value: "雨", emoji: "🌧️" },
  { value: "雪", emoji: "🌨️" },
] as const;

export type ReportWeatherValue = (typeof REPORT_WEATHER_OPTIONS)[number]["value"];

const WEATHER_ALIASES: Record<string, ReportWeatherValue> = {
  晴れ: "晴れ",
  快晴: "晴れ",
  くもり: "くもり",
  曇り: "くもり",
  曇: "くもり",
  雨: "雨",
  雪: "雪",
};

export function weatherTextForStorage(raw: string | null | undefined): string {
  const stripped = (raw ?? "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\uFE0F]/gu, "")
    .trim();
  if (!stripped) {
    return "";
  }
  return WEATHER_ALIASES[stripped] ?? stripped;
}

export function isKnownWeather(value: string): boolean {
  return REPORT_WEATHER_OPTIONS.some((item) => item.value === value);
}

/** PDF / print: Japanese only. Never include emoji (Noto JP may lack glyphs). */
export function weatherLineForPdf(raw: string | null | undefined): string | null {
  const text = weatherTextForStorage(raw);
  if (!text) {
    return null;
  }
  return `【天候】${text}`;
}

export const REPORT_SAFETY_PRESETS = ["異常なし", "KY実施", "安全巡回実施", "注意事項あり"] as const;

export const REPORT_SAFETY_NOTE_PRESET = "注意事項あり";

export const REPORT_WORK_FALLBACKS = ["KY実施", "配筋確認", "コンクリート打設", "写真撮影", "安全確認"] as const;

export const TASK_QUICK_PRESETS = REPORT_WORK_FALLBACKS;

export function dueOnForChip(chip: "today" | "tomorrow" | "none", todayIso: string): string {
  if (chip === "today") {
    return todayIso;
  }
  if (chip === "tomorrow") {
    return addDaysIso(todayIso, 1);
  }
  return "";
}

export function formatSafetyNotes(selected: readonly string[], extra = ""): string {
  const presets = REPORT_SAFETY_PRESETS.filter((item) => selected.includes(item));
  const note = extra.trim();
  if (presets.includes(REPORT_SAFETY_NOTE_PRESET) && note) {
    return [...presets, note].join("\n");
  }
  return presets.join("\n");
}

export function parseSafetyNotes(raw: string | null | undefined): { selected: string[]; extra: string } {
  const text = (raw ?? "").trim();
  if (!text) {
    return { selected: [], extra: "" };
  }
  const selected = REPORT_SAFETY_PRESETS.filter((item) => text.includes(item));
  const leftover = text
    .split(/\n/)
    .map((line) => line.replace(/^・/, "").trim())
    .filter((line) => line && !(REPORT_SAFETY_PRESETS as readonly string[]).includes(line))
    .join("\n");
  return { selected, extra: leftover };
}

export function appendReportLine(current: string, line: string): string {
  const item = line.trim();
  if (!item) {
    return current;
  }
  const existing = current.trim();
  const already = existing
    .split(/\n/)
    .map((row) => row.replace(/^・\s*/, "").trim())
    .includes(item);
  if (already) {
    return current;
  }
  const bullet = `・${item}`;
  return existing ? `${existing}\n${bullet}` : bullet;
}

export function workCandidatesFromTasks(
  tasks: readonly { title: string; status: string }[],
): { title: string; done: boolean }[] {
  if (tasks.length === 0) {
    return REPORT_WORK_FALLBACKS.map((title) => ({ title, done: false }));
  }
  return tasks.map((task) => ({ title: task.title, done: task.status === "done" }));
}

export function openTaskTitles(tasks: readonly { title: string; status: string }[]): string[] {
  return tasks.filter((task) => task.status !== "done").map((task) => task.title);
}
