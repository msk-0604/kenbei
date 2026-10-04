/** Trim and cap a person's name as shown on reports. */
export function normalizeDisplayName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 40);
}

/**
 * New accounts start with the e-mail's local part as their name. Treat that
 * (or an empty name) as "not set yet" so we can ask for a real one.
 */
export function needsRealName(displayName: string | null | undefined, email: string | null | undefined): boolean {
  const name = (displayName ?? "").trim();
  if (!name) {
    return true;
  }
  const local = (email ?? "").split("@")[0]?.trim().toLowerCase() ?? "";
  return name.toLowerCase() === local || name.toLowerCase() === (email ?? "").trim().toLowerCase();
}
