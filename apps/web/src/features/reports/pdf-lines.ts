import { weatherLineForPdf } from "@kensapo/domain";

export function dailyReportPdfLines(report: {
  projectName: string;
  weather: string | null;
  body: string;
  safetyNotes: string | null;
  progressNote: string | null;
  tomorrowPlan: string | null;
}): string[] {
  return [
    report.projectName,
    weatherLineForPdf(report.weather) ?? "",
    report.body,
    report.safetyNotes ? `【安全】${report.safetyNotes}` : "",
    report.progressNote ?? "",
    report.tomorrowPlan ?? "",
  ].filter((line) => line.trim().length > 0);
}
