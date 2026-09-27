export function isMissingSalesTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) {
    return false;
  }
  if (error.code === "42P01" || error.code === "PGRST205") {
    return true;
  }
  return /sales_funnel_events|trial_lifecycle_emails|schema cache/i.test(error.message ?? "");
}
