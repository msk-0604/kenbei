export type ConstructionBlackboard = {
  projectName: string;
  workType: string;
  location: string;
  description: string;
  date: string;
  companyName: string;
};

export const BLACKBOARD_FIELD_LABELS = {
  projectName: "工事名",
  workType: "工種",
  location: "場所",
  description: "内容",
  date: "日付",
  companyName: "施工者",
} as const;

export function todayBlackboardDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

export function emptyBlackboard(partial?: Partial<ConstructionBlackboard>): ConstructionBlackboard {
  return {
    projectName: partial?.projectName ?? "",
    workType: partial?.workType ?? "",
    location: partial?.location ?? "",
    description: partial?.description ?? "",
    date: partial?.date ?? todayBlackboardDate(),
    companyName: partial?.companyName ?? "",
  };
}

export function blackboardToComment(board: ConstructionBlackboard): string {
  return [
    `【黒板】`,
    `${BLACKBOARD_FIELD_LABELS.projectName}: ${board.projectName}`,
    `${BLACKBOARD_FIELD_LABELS.workType}: ${board.workType}`,
    `${BLACKBOARD_FIELD_LABELS.location}: ${board.location}`,
    `${BLACKBOARD_FIELD_LABELS.description}: ${board.description}`,
    `${BLACKBOARD_FIELD_LABELS.date}: ${board.date}`,
    `${BLACKBOARD_FIELD_LABELS.companyName}: ${board.companyName}`,
  ].join("\n");
}
