/** Calendar duration. Inclusive of start and end dates. No LLM. */

const MS_PER_DAY = 86_400_000;

export function calcDurationDays(startOn: string, endOn: string): number {
  const start = parseIsoDate(startOn);
  const end = parseIsoDate(endOn);
  const diff = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  return diff + 1;
}

export function parseIsoDate(isoDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date;
}
