export function isTaskOverdue(input: { status: string; dueOn: string | null; todayIso: string }): boolean {
  if (input.status === "done" || !input.dueOn) {
    return false;
  }
  return input.dueOn < input.todayIso;
}

export function isProcessDelayed(input: {
  status: string;
  percent: number;
  plannedEndOn: string | null;
  todayIso: string;
}): boolean {
  if (input.status === "completed" || input.percent >= 100) {
    return false;
  }
  if (input.status === "delayed") {
    return true;
  }
  return Boolean(input.plannedEndOn && input.plannedEndOn < input.todayIso);
}

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
