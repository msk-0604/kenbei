"use client";

import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import {
  passkeyLoginOptionsAction,
  passkeyRegistrationOptionsAction,
  verifyPasskeyLoginAction,
  verifyPasskeyRegistrationAction,
} from "@/features/auth/passkey-actions";

const OFFER_KEY = "kb_passkey_offer";

/** この端末で顔認証・指紋が使えるか（スマホや Touch ID 付きのパソコン） */
export async function canUseDevicePasskey(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) {
    return false;
  }
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

/** ログイン後に「顔認証を使いますか」を勧めてよいか（登録済み・断った端末には出さない） */
export function shouldOfferPasskey(): boolean {
  try {
    return window.localStorage.getItem(OFFER_KEY) === null;
  } catch {
    return false;
  }
}

export function markPasskeyOffer(value: "registered" | "dismissed"): void {
  try {
    window.localStorage.setItem(OFFER_KEY, value);
  } catch {
    // 端末に保存できなくても困らない
  }
}

function cancelled(error: unknown): boolean {
  return error instanceof Error && (error.name === "NotAllowedError" || error.name === "AbortError");
}

export async function registerThisDevice(): Promise<{ ok: true } | { ok: false; error: string; cancelled?: boolean }> {
  const prepared = await passkeyRegistrationOptionsAction();
  if (!prepared.ok) {
    return prepared;
  }
  try {
    const response = await startRegistration({ optionsJSON: prepared.options });
    const result = await verifyPasskeyRegistrationAction(prepared.challengeId, response);
    if (result.ok) {
      markPasskeyOffer("registered");
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "InvalidStateError") {
      markPasskeyOffer("registered");
      return { ok: false, error: "この端末はもう登録されています。" };
    }
    return { ok: false, error: "登録をやめました。", cancelled: cancelled(error) };
  }
}

export async function signInWithPasskey(): Promise<{ ok: true } | { ok: false; error: string; cancelled?: boolean }> {
  const prepared = await passkeyLoginOptionsAction();
  if (!prepared.ok) {
    return prepared;
  }
  try {
    const response = await startAuthentication({ optionsJSON: prepared.options });
    return await verifyPasskeyLoginAction(prepared.challengeId, response);
  } catch (error) {
    return { ok: false, error: "顔認証をやめました。", cancelled: cancelled(error) };
  }
}
