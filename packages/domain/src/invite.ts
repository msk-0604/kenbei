export const INVITE_ROLE_CODES = ["worker", "supervisor", "manager"] as const;
export type InviteRoleCode = (typeof INVITE_ROLE_CODES)[number];

export const INVITE_PREVIEW_KEYS = [
  "company_name",
  "role_label",
  "invite_state",
  "email_state",
  "invited_email",
] as const;
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
  return `現在 ${currentCompanyName} に所属しているため、この招待には参加できません。`;
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

export function inviteJoinPath(token: string, grant?: string | null): string {
  const path = `/join?token=${token}`;
  return grant ? `${path}&grant=${grant}` : path;
}

export function inviteTokenFromNextPath(value: string | null | undefined): string {
  const parsed = parseInviteJoinSearch(value);
  return parsed?.token ?? "";
}

export function parseInviteJoinSearch(
  value: string | null | undefined,
): { token: string; grant: string; proof: string } | null {
  if (!isSafeInviteNextPath(value)) {
    return null;
  }
  const parsed = parseJoinQuery(value ?? "");
  return { token: parsed.token, grant: parsed.grant, proof: parsed.proof };
}

export function isSafeInviteNextPath(value: string | null | undefined): boolean {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://") || value.includes("\\")) {
    return false;
  }
  if (!value.startsWith("/join?")) {
    return false;
  }
  const parsed = parseJoinQuery(value);
  if (parsed.unknown || !parsed.token) {
    return false;
  }
  if (!/^[a-f0-9]{32,}$/i.test(parsed.token)) {
    return false;
  }
  if (parsed.proof && !isInviteSignupGrantSecret(parsed.proof)) {
    return false;
  }
  if (parsed.grant && !isInviteSignupGrantSecret(parsed.grant)) {
    return false;
  }
  return true;
}

export function isInviteSignupGrantSecret(value: string | null | undefined): boolean {
  return /^[a-f0-9]{64}$/i.test(value ?? "");
}

function parseJoinQuery(value: string): { token: string; grant: string; proof: string; unknown: boolean } {
  const query = value.slice(value.indexOf("?") + 1);
  let token = "";
  let grant = "";
  let proof = "";
  let unknown = false;
  for (const part of query.split("&")) {
    if (!part) {
      continue;
    }
    const eq = part.indexOf("=");
    const key = eq === -1 ? part : part.slice(0, eq);
    const raw = eq === -1 ? "" : part.slice(eq + 1);
    if (key === "token") {
      token = raw;
    } else if (key === "grant") {
      grant = raw;
    } else if (key === "proof") {
      proof = raw;
    } else {
      unknown = true;
    }
  }
  return { token, grant, proof, unknown };
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

export function inviteAccountExistsMessage(): string {
  return "このメールアドレスは登録済みです。ログインして参加してください。";
}

export function canSkipInviteEmailConfirmation(input?: { grantRedeemed?: boolean }): boolean {
  return Boolean(input?.grantRedeemed);
}

export function inviteSignupGrantRedeemable(input: {
  hashMatches: boolean;
  used: boolean;
  grantExpired: boolean;
  inviteExpired: boolean;
  deleted: boolean;
  accepted: boolean;
  email: string | null | undefined;
}): boolean {
  return (
    input.hashMatches &&
    !input.used &&
    !input.grantExpired &&
    !input.inviteExpired &&
    !input.deleted &&
    !input.accepted &&
    Boolean(normalizeInviteEmail(input.email))
  );
}

export function sanitizeInviteCompanyName(value: string | null | undefined): string {
  return (value ?? "").replace(/[<>\r\n]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function inviteCheckEmailPath(input: {
  next?: string | null;
  companyName?: string | null;
  email?: string | null;
}): string {
  const parts: string[] = [];
  const next = safeAuthNextPath(input.next);
  if (next) {
    parts.push(`next=${encodeURIComponent(next)}`);
  }
  const company = sanitizeInviteCompanyName(input.companyName);
  if (company) {
    parts.push(`company=${encodeURIComponent(company)}`);
  }
  const email = normalizeInviteEmail(input.email);
  if (email) {
    parts.push(`email=${encodeURIComponent(email)}`);
  }
  return parts.length ? `/signup/check-email?${parts.join("&")}` : "/signup/check-email";
}

export function inviteJoinSignupHint(companyName: string, mode: "confirm" | "grant" = "confirm"): string {
  const company = sanitizeInviteCompanyName(companyName) || "会社";
  if (mode === "grant") {
    return `パスワードを決めて登録すると、追加の確認メールなしで ${company} の今日の画面に進みます。`;
  }
  return `パスワードを決めたあと、確認メールのリンクを1回開いてください。追加のログインは不要で、${company} の今日の画面に進みます。`;
}

export function inviteConfirmInboxTitle(companyName?: string | null): string {
  const company = sanitizeInviteCompanyName(companyName);
  return company ? `${company}に参加する前に、メールを確認` : "メールを確認してください";
}

export function inviteConfirmInboxDescription(input: {
  companyName?: string | null;
  email?: string | null;
}): string {
  const company = sanitizeInviteCompanyName(input.companyName) || "会社";
  const email = normalizeInviteEmail(input.email);
  const dest = email ? `${email} に確認メールを送りました。` : "確認メールを送りました。";
  return `${dest}メール内のリンクを開くと、追加のログインなしで ${company} の今日の画面に進みます。`;
}

export function inviteConfirmInboxSteps(companyName?: string | null): string[] {
  const company = sanitizeInviteCompanyName(companyName) || "会社";
  return [
    "メールアプリを開き、KENBEIからの確認メールを探す",
    "確認リンクを開く（同じ端末でも、別の端末でもよい）",
    `自動で ${company} に参加し、今日の画面へ進む`,
  ];
}

function lowerEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
