import { isSafeInviteNextPath, safeAuthNextPath } from "@kensapo/domain";

export function rememberJoinNext(next: string): string {
  return isSafeInviteNextPath(next) ? next : "";
}

export function resolveAuthNext(queryNext: string | null | undefined, cookieNext: string): string {
  const fromQuery = safeAuthNextPath(queryNext);
  if (fromQuery) {
    return fromQuery;
  }
  return cookieNext;
}
