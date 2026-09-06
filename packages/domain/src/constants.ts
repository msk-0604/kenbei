export const SIGNAL_KINDS = ["recommendation", "caution", "prediction"] as const;

export type SignalKind = (typeof SIGNAL_KINDS)[number];

export const SYSTEM_ROLE_CODES = [
  "owner",
  "executive",
  "manager",
  "supervisor",
  "worker",
  "office",
  "partner",
  "guest",
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

export const PROJECT_STATUSES = [
  "draft",
  "active",
  "on_hold",
  "completed",
  "cancelled",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const CAPTURE_KINDS = ["voice", "photo", "tap", "import"] as const;

export type CaptureKind = (typeof CAPTURE_KINDS)[number];

export const CAPTURE_FIELD_STATUSES = [
  "pending",
  "auto_accepted",
  "confirmed",
  "corrected",
  "rejected",
] as const;

export type CaptureFieldStatus = (typeof CAPTURE_FIELD_STATUSES)[number];
