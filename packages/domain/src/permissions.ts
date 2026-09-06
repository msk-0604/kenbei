export const PERMISSION_CODES = [
  "org.manage",
  "org.security",
  "member.manage",
  "member.read",
  "role.manage",
  "project.create",
  "project.update",
  "project.read_all",
  "project.close",
  "finance.read",
  "finance.write",
  "capture.create",
  "capture.confirm",
  "photo.create",
  "knowledge.read",
  "knowledge.write",
  "signal.read_management",
  "signal.feedback",
  "import.manage",
  "audit.read",
  "catalog.manage",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export function isPermissionCode(value: string): value is PermissionCode {
  return (PERMISSION_CODES as readonly string[]).includes(value);
}
