/** 日報一覧の「今日の日報を作る」で選べる現場。今日予定がある現場を先に並べ、同じ現場は一度だけ出す。 */

export type ReportSiteChoice = { id: string; name: string; scheduledToday: boolean };

export function reportSiteChoices(input: {
  scheduledToday: readonly { id: string; name: string }[];
  assigned: readonly { id: string; name: string }[];
  others: readonly { id: string; name: string }[];
}): ReportSiteChoice[] {
  const seen = new Set<string>();
  const out: ReportSiteChoice[] = [];
  for (const [list, scheduledToday] of [
    [input.scheduledToday, true],
    [input.assigned, false],
    [input.others, false],
  ] as const) {
    for (const site of list) {
      if (seen.has(site.id)) continue;
      seen.add(site.id);
      out.push({ id: site.id, name: site.name, scheduledToday });
    }
  }
  return out;
}

/** 最初から選んでおく現場。迷わない時（候補が1つ、または今日の予定が1現場だけ）以外は選ばずに聞く。 */
export function defaultReportSiteId(choices: readonly ReportSiteChoice[]): string {
  const candidates = choices.length === 1 ? choices : choices.filter((choice) => choice.scheduledToday);
  return candidates.length === 1 ? (candidates[0]?.id ?? "") : "";
}
