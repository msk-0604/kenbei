/** 顔認証・指紋（パスキー）の小さな決まりごと。サーバーでも画面でも使う。 */

export const PASSKEY_RP_NAME = "KENBEI";

/**
 * パスキーは「どのサイトのものか」を、開いているホスト名で決める。
 * 本番は app.kenbei.jp、プレビューやローカルではそのホスト名になる。
 */
export function relyingParty(host: string | null | undefined, proto: string | null | undefined): { rpID: string; origin: string } | null {
  const cleanHost = (host ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (!cleanHost || /[\s/@]/.test(cleanHost)) {
    return null;
  }
  const hostname = cleanHost.replace(/:\d+$/, "");
  const scheme = (proto ?? "").split(",")[0]?.trim() === "http" && (hostname === "localhost" || hostname === "127.0.0.1") ? "http" : "https";
  return { rpID: hostname, origin: `${scheme}://${cleanHost}` };
}

/** 設定画面に出す端末の名前（User-Agent から大まかに） */
export function deviceNameFromUserAgent(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  return "この端末";
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const buffer = Buffer.from(value, "base64url");
  const out = new Uint8Array(new ArrayBuffer(buffer.length));
  out.set(buffer);
  return out;
}

/** 顔認証を使えるホスト（本番のアプリ・Vercel のプレビュー・ローカル） */
export function isAllowedPasskeyHost(hostname: string, appUrl: string): boolean {
  let appHost = "";
  try {
    appHost = new URL(appUrl).hostname.toLowerCase();
  } catch {
    appHost = "";
  }
  return (
    hostname === appHost ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^[a-z0-9-]+\.vercel\.app$/.test(hostname)
  );
}
