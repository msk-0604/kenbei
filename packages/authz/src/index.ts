import {
  PERMISSION_CODES,
  type PermissionCode,
  type SystemRoleCode,
} from "@kensapo/domain";

export { PERMISSION_CODES };
export type { PermissionCode };

/** Default permission sets. Runtime still reads role_permissions from DB. */
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleCode, readonly PermissionCode[]> = {
  owner: PERMISSION_CODES,
  executive: [
    "member.read",
    "project.read_all",
    "project.create",
    "project.update",
    "project.close",
    "finance.read",
    "knowledge.read",
    "knowledge.write",
    "signal.read_management",
    "signal.feedback",
    "audit.read",
  ],
  manager: [
    "member.manage",
    "member.read",
    "project.read_all",
    "project.create",
    "project.update",
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
    "catalog.manage",
  ],
  supervisor: [
    "member.read",
    "project.update",
    "capture.create",
    "capture.confirm",
    "photo.create",
    "knowledge.read",
    "knowledge.write",
    "signal.feedback",
  ],
  worker: [
    "capture.create",
    "capture.confirm",
    "photo.create",
    "knowledge.read",
    "signal.feedback",
  ],
  office: [
    "member.manage",
    "member.read",
    "project.read_all",
    "project.create",
    "project.update",
    "finance.read",
    "knowledge.read",
    "signal.read_management",
    "import.manage",
    "catalog.manage",
  ],
  partner: ["capture.create", "capture.confirm", "photo.create", "signal.feedback"],
  guest: [],
};

export const PROJECT_SCOPED_ROLES: readonly SystemRoleCode[] = [
  "supervisor",
  "worker",
  "partner",
  "guest",
];

export function hasPermission(
  granted: readonly PermissionCode[],
  required: PermissionCode,
): boolean {
  return granted.includes(required);
}

export function assertPermission(
  granted: readonly PermissionCode[],
  required: PermissionCode,
): void {
  if (!hasPermission(granted, required)) {
    throw new PermissionDeniedError(required);
  }
}

export class PermissionDeniedError extends Error {
  readonly code = "permission_denied" as const;

  constructor(readonly permission: PermissionCode) {
    super(`Missing permission: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

export function isProjectScopedRole(role: SystemRoleCode): boolean {
  return PROJECT_SCOPED_ROLES.includes(role);
}
