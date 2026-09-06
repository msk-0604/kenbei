import type { DailyReportDraftInput, DailyReportDraftResult } from "./contract";

export function draftDailyReportTemplate(input: DailyReportDraftInput): DailyReportDraftResult {
  const locations = [
    ...new Set(
      input.photoNotes
        .map((note) => note.trim())
        .filter(Boolean)
        .slice(0, 8),
    ),
  ];
  const photoLine =
    locations.length > 0
      ? locations.map((note, index) => `${index + 1}. ${note}`).join("\n")
      : "本日の写真記録あり。詳細は添付写真を確認。";
  const taskLine =
    input.taskNotes.length > 0 ? input.taskNotes.map((note) => `・${note}`).join("\n") : "特記事項なし。";
  const progress = input.progressNote ?? "工程どおり進行。";
  const work = input.workSummary ?? "現場作業を実施。";

  const body = [
    `【現場】${input.projectName}`,
    `【日付】${input.workOn}`,
    `【記入】${input.authorName}`,
    input.weather ? `【天候】${input.weather}` : null,
    "",
    "■ 作業内容",
    work,
    "",
    "■ 写真から確認した作業",
    photoLine,
    "",
    "■ 進捗",
    progress,
    "",
    "■ 残作業・タスク",
    taskLine,
    "",
    "■ 安全",
    "KY実施。高所・火気・開口部・通路の確認。",
    "",
    input.similarHints && input.similarHints.length > 0 ? "■ 類似現場の参考（未確定）" : null,
    input.similarHints && input.similarHints.length > 0 ? input.similarHints.map((line) => `・${line}`).join("\n") : null,
    "",
    "■ 明日の予定",
    "本日の続きと未完了箇所の確認。",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    body,
    workLocation: locations[0],
    progressNote: progress,
    safetyNotes: "KY実施。高所・火気・開口部・通路の確認。",
    tomorrowPlan: "本日の続きと未完了箇所の確認。",
    issues: input.taskNotes.find((note) => /遅延|問題|不足|手直し/.test(note)),
    provider: "null",
    model: "template",
  };
}
