export const INVITE_ROLE_CODES = ["worker", "supervisor", "manager"] as const;
export type InviteRoleCode = (typeof INVITE_ROLE_CODES)[number];

export const INVITE_PREVIEW_KEYS = ["company_name", "role_label", "invite_state", "email_state"] as const;
export type InvitePreviewState = "ok" | "used" | "expired" | "not_found";
export type InviteEmailState = "anon" | "open" | "match" | "mismatch";

export function isInviteRoleCode(value: string): value is InviteRoleCode {
  return (INVITE_ROLE_CODES as readonly string[]).includes(value);
}

export function inviteRoleLabel(code: string | null | undefined): string {
  switch (code) {
    case "supervisor":
      return "現場管理者";
    case "manager":
      return "管理者";
    case "worker":
      return "一般メンバー";
    case "office":
      return "事務";
    case "executive":
      return "経営";
    case "owner":
      return "代表";
    case "partner":
      return "協力会社";
    case "guest":
      return "ゲスト";
    default:
      return "メンバー";
  }
}

export function inviteRequiresEmailMatch(inviteEmail: string | null | undefined): boolean {
  return inviteEmail != null;
}

export function inviteEmailMatches(
  inviteEmail: string | null | undefined,
  userEmail: string | null | undefined,
): boolean {
  if (!inviteRequiresEmailMatch(inviteEmail)) {
    return true;
  }
  return lowerEmail(inviteEmail) === lowerEmail(userEmail);
}

export function blockedByOtherOrganization(
  activeOrganizationIds: readonly string[],
  inviteOrganizationId: string,
): boolean {
  return activeOrganizationIds.some((id) => id !== inviteOrganizationId);
}

export function canAcceptInvite(input: {
  tokenFound: boolean;
  used: boolean;
  expired: boolean;
  deleted: boolean;
  inviteEmail: string | null | undefined;
  userEmail: string | null | undefined;
  activeOrganizationIds: readonly string[];
  inviteOrganizationId: string;
}): { ok: true } | { ok: false; reason: "missing" | "used" | "expired" | "email" | "other_org" } {
  if (!input.tokenFound || input.deleted) {
    return { ok: false, reason: "missing" };
  }
  if (input.used) {
    return { ok: false, reason: "used" };
  }
  if (input.expired) {
    return { ok: false, reason: "expired" };
  }
  if (!inviteEmailMatches(input.inviteEmail, input.userEmail)) {
    return { ok: false, reason: "email" };
  }
  if (blockedByOtherOrganization(input.activeOrganizationIds, input.inviteOrganizationId)) {
    return { ok: false, reason: "other_org" };
  }
  return { ok: true };
}

export function extraInvitePreviewKeys(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter(
    (key) => !(INVITE_PREVIEW_KEYS as readonly string[]).includes(key),
  );
}

export function acceptInviteRpcArgs(token: string): { p_token: string } {
  return { p_token: token };
}

export function alreadyInCompanyMessage(currentCompanyName: string): string {
  return `現在 ${currentCompanyName} に所属しています。この会社に参加するには、今の会社からの退出が必要です。`;
}

export function canCancelInvite(input: {
  sessionOrganizationId: string;
  inviteOrganizationId: string;
  accepted: boolean;
  alreadyDeleted: boolean;
}): { ok: true } | { ok: false; reason: "other_org" | "used" | "already_canceled" } {
  if (input.inviteOrganizationId !== input.sessionOrganizationId) {
    return { ok: false, reason: "other_org" };
  }
  if (input.accepted) {
    return { ok: false, reason: "used" };
  }
  if (input.alreadyDeleted) {
    return { ok: false, reason: "already_canceled" };
  }
  return { ok: true };
}

export function inviteCancelUpdate(nowIso: string): { deleted_at: string } {
  return { deleted_at: nowIso };
}

export function normalizeInviteEmail(value: string | null | undefined): string | null {
  const email = (value ?? "").trim().toLowerCase();
  if (!email || !email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
    return null;
  }
  return email;
}

export function inviteJoinPath(token: string): string {
  return `/join?token=${token}`;
}

export function isSafeInviteNextPath(value: string | null | undefined): boolean {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://") || value.includes("\\")) {
    return false;
  }
  const match = /^\/join\?token=([a-f0-9]{32,})$/i.exec(value);
  return Boolean(match);
}

export function safeAuthNextPath(value: string | null | undefined): string {
  const next = (value ?? "").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://") || next.includes("\\")) {
    return "";
  }
  return next;
}

export function canResendInvite(input: {
  sessionOrganizationId: string;
  inviteOrganizationId: string;
  accepted: boolean;
  alreadyDeleted: boolean;
  email: string | null | undefined;
}): { ok: true } | { ok: false; reason: "other_org" | "used" | "already_canceled" | "no_email" } {
  const cancel = canCancelInvite(input);
  if (!cancel.ok) {
    return cancel;
  }
  if (!normalizeInviteEmail(input.email)) {
    return { ok: false, reason: "no_email" };
  }
  return { ok: true };
}

export function inviteMailFailedMessage(): string {
  return "招待は作成しましたが、メールを送信できませんでした。リンクをコピーして送ることもできます。";
}

export function inviteDuplicateEmailMessage(): string {
  return "このメールアドレスには、すでに招待中です。下の招待中から再送できます。";
}

export function inviteEmailMismatchMessage(): string {
  return "この招待は別のメールアドレス宛です。";
}

function lowerEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
