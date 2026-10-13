import type { ScheduleWithDetails } from "@/features/sites/types";

/** 現場ごとに予定をまとめる（一覧の「ぱっと見」用） */
export function groupSchedulesByProject(schedules: ScheduleWithDetails[]): {
  projectId: string;
  projectName: string;
  items: ScheduleWithDetails[];
  workerNames: string[];
}[] {
  const order: string[] = [];
  const map = new Map<string, { projectId: string; projectName: string; items: ScheduleWithDetails[] }>();
  for (const s of schedules) {
    const existing = map.get(s.project_id);
    if (existing) {
      existing.items.push(s);
    } else {
      order.push(s.project_id);
      map.set(s.project_id, { projectId: s.project_id, projectName: s.project_name, items: [s] });
    }
  }
  return order.map((id) => {
    const group = map.get(id)!;
    return { ...group, workerNames: uniqueWorkerNames(group.items) };
  });
}

export function uniqueWorkerNames(schedules: ScheduleWithDetails[]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const s of schedules) {
    const name = s.worker_name?.trim();
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return names;
}

/** project_id → その日の作業員名 */
export function workerNamesByProject(schedules: ScheduleWithDetails[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const group of groupSchedulesByProject(schedules)) {
    result[group.projectId] = group.workerNames;
  }
  return result;
}
