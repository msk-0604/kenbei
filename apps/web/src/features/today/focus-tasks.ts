import { isTaskOverdue } from "@kensapo/domain";

export const TODAY_FOCUS_TASK_LIMIT = 8;

export type TodayFocusTaskInput = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  dueOn: string | null;
};

export type TodayFocusTask = TodayFocusTaskInput & {
  projectName: string;
  overdue: boolean;
  dueToday: boolean;
};

export function pickTodayFocusTasks(
  rows: TodayFocusTaskInput[],
  projectNameById: Map<string, string>,
  todayIso: string,
  limit = TODAY_FOCUS_TASK_LIMIT,
): TodayFocusTask[] {
  const mapped = rows
    .filter((row) => row.status !== "done")
    .map((row) => {
      const overdue = isTaskOverdue({ status: row.status, dueOn: row.dueOn, todayIso });
      const dueToday = Boolean(row.dueOn && row.dueOn === todayIso && row.status !== "done");
      return {
        ...row,
        projectName: projectNameById.get(row.projectId) ?? "",
        overdue,
        dueToday,
      };
    });

  const overdue = mapped.filter((row) => row.overdue);
  const dueToday = mapped.filter((row) => !row.overdue && row.dueToday);
  const inPlay = mapped.filter(
    (row) => !row.overdue && !row.dueToday && (row.status === "in_progress" || row.status === "review"),
  );

  const picked: TodayFocusTask[] = [];
  const seen = new Set<string>();
  for (const row of [...overdue, ...dueToday, ...inPlay]) {
    if (seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    picked.push(row);
    if (picked.length >= limit) {
      break;
    }
  }
  return picked;
}
