/**
 * 共通の合言葉でログインした端末では、サーバーは「誰が見ているか」を区別できない。
 * そのため名前は端末の localStorage にだけ保存し、「自分の予定」の表示に使う。
 */
export const PERSON_NAME_KEY = "kenbei-person-name";

export function normalizePersonName(name: string): string {
  return name.replace(/[\s　]/g, "").trim();
}

export function readPersonName(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return window.localStorage.getItem(PERSON_NAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function savePersonName(name: string): void {
  try {
    window.localStorage.setItem(PERSON_NAME_KEY, name.trim());
  } catch {
    // プライベートモードなどでは保存できない。表示だけ続ける。
  }
}

export function clearPersonName(): void {
  try {
    window.localStorage.removeItem(PERSON_NAME_KEY);
  } catch {
    // noop
  }
}
