export const PERMISSIONS = [
  "project.update",
  "capture.create",
  "capture.confirm",
  "photo.create",
] as const;

export type AppPermission = (typeof PERMISSIONS)[number];

export function can(granted: readonly string[], required: AppPermission): boolean {
  return granted.includes(required);
}

export function filterPermissionCodes(values: readonly string[]): string[] {
  return values.filter((value) => (PERMISSIONS as readonly string[]).includes(value) || value.length > 0);
}
