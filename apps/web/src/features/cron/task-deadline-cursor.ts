export const TASK_DEADLINE_PAGE_SIZE = 200;
export const TASK_DEADLINE_MAX_PAGES = 100;

export type TaskDeadlineCursor = {
  dueOn: string;
  id: string;
};

export type TaskDeadlineRow = {
  id: string;
  due_on: string;
};

export function nextTaskDeadlineCursor(rows: TaskDeadlineRow[]): TaskDeadlineCursor | null {
  const last = rows[rows.length - 1];
  if (!last) {
    return null;
  }
  return { dueOn: last.due_on, id: last.id };
}

export function shouldFetchNextTaskDeadlinePage(rowCount: number, pageSize = TASK_DEADLINE_PAGE_SIZE): boolean {
  return rowCount === pageSize;
}

/** Keyset: (due_on, id) > cursor. Safer than OFFSET for large overdue sets. */
export function taskDeadlineOrFilter(cursor: TaskDeadlineCursor): string {
  return `due_on.gt.${cursor.dueOn},and(due_on.eq.${cursor.dueOn},id.gt.${cursor.id})`;
}
