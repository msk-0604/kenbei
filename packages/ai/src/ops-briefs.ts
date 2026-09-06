export type OpsBriefFacts = {
  organizationName: string;
  projectName?: string;
  pendingConfirmCount: number;
  overdueTaskTitles: string[];
  delayedProcessNames: string[];
  draftReportCount: number;
  failedUploadCount: number;
  chatLines?: string[];
  reportLines?: string[];
  similarLines?: string[];
};

export function briefProjectSummary(facts: OpsBriefFacts): string {
  const lines = [
    `【現場要約】${facts.projectName ?? facts.organizationName}`,
    facts.delayedProcessNames.length > 0
      ? `遅れている工程: ${facts.delayedProcessNames.join("、")}`
      : "工程遅延の記録はありません。",
    facts.overdueTaskTitles.length > 0
      ? `期限超過タスク: ${facts.overdueTaskTitles.slice(0, 5).join("、")}`
      : "期限超過タスクはありません。",
    `確認待ち ${facts.pendingConfirmCount}件 / 日報下書き ${facts.draftReportCount}件`,
  ];
  return lines.join("\n");
}

export function briefWeeklySummary(facts: OpsBriefFacts): string {
  const reports = facts.reportLines?.slice(0, 8) ?? [];
  return [
    `【週次要約】${facts.projectName ?? facts.organizationName}`,
    reports.length > 0 ? reports.map((line) => `・${line}`).join("\n") : "この7日の日報はありません。",
    facts.delayedProcessNames.length > 0 ? `遅延: ${facts.delayedProcessNames.join("、")}` : "遅延なし。",
  ].join("\n");
}

export function briefChatSummary(lines: string[]): string {
  if (lines.length === 0) {
    return "チャットはまだありません。";
  }
  return ["【チャット要約】直近のやりとり", ...lines.slice(0, 12).map((line) => `・${line}`)].join("\n");
}

export function briefDelayRisk(facts: OpsBriefFacts): string {
  const delayed = facts.delayedProcessNames;
  const similar = facts.similarLines ?? [];
  if (delayed.length === 0) {
    return "現時点で工程遅延はありません。類似現場の遅延率も参考にしてください。";
  }
  return [
    "【遅延リスク】",
    `${delayed.join("、")} が遅れています。`,
    similar.length > 0 ? `似た現場の参考: ${similar.join(" / ")}` : "比較できる類似現場はまだ少ないです。",
    "AIは工程を変更しません。復旧タスクは人が確認して追加してください。",
  ].join("\n");
}

export function proposeTaskTitles(facts: OpsBriefFacts): string[] {
  const out: string[] = [];
  for (const name of facts.delayedProcessNames) {
    out.push(`工程「${name}」の遅れを回復する`);
  }
  for (const title of facts.overdueTaskTitles.slice(0, 3)) {
    out.push(`期限超過の確認: ${title}`);
  }
  if (facts.pendingConfirmCount > 0) {
    out.push("未確認の写真・音声を今日中に確認する");
  }
  return [...new Set(out)].slice(0, 6);
}

export function photoAssistFromFilename(fileName?: string, existing?: string | null): string {
  if (existing?.trim()) {
    return existing.trim();
  }
  if (!fileName) {
    return "施工状況の記録写真。箇所・工種を確認してください。";
  }
  return `ファイル名「${fileName}」からの候補説明です。確定する前に現場と照合してください。`;
}
