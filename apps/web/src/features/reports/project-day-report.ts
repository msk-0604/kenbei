export type ProjectDayReportRow = {
  id: string;
  status?: string;
  taskId?: string | null;
  task_id?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
};

function taskIdOf(row: ProjectDayReportRow): string | null {
  return row.taskId ?? row.task_id ?? null;
}

function updatedOf(row: ProjectDayReportRow): string {
  return row.updatedAt ?? row.updated_at ?? "";
}

/**
 * Old screens expect one report per project-day.
 * After multiple assignment reports can exist, pick the legacy row (no task_id)
 * or the newest row. Do not use maybeSingle() on the full set.
 */
export function pickProjectDayReport<T extends ProjectDayReportRow>(rows: T[]): T | null {
  if (rows.length === 0) {
    return null;
  }
  const legacy = rows.filter((row) => !taskIdOf(row));
  const pool = legacy.length > 0 ? legacy : rows;
  return [...pool].sort((a, b) => updatedOf(b).localeCompare(updatedOf(a)))[0] ?? null;
}
