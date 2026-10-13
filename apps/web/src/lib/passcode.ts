import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * 合言葉ログイン（kenbei-alpha の「会社の合言葉」）。
 * 多くの会社が使うので、合言葉は「会社コード（6桁）」と組み合わせて照合し、
 * 会社ごとに塩を付けた scrypt で保存する（同じ合言葉でも会社が違えば別物）。
 */

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

export const PASSCODE_MIN_LENGTH = 4;
export const PASSCODE_MAX_LENGTH = 50;

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

export function normalizePasscode(raw: string): string {
  return raw.normalize("NFKC").replace(/[\s　]/g, "").trim();
}

export function isValidPasscode(value: string): boolean {
  return value.length >= PASSCODE_MIN_LENGTH && value.length <= PASSCODE_MAX_LENGTH;
}

export function normalizeLoginCode(raw: string): string {
  return raw.normalize("NFKC").replace(/[^0-9]/g, "");
}

export function isValidLoginCode(value: string): boolean {
  return /^[0-9]{6}$/.test(value);
}

export function generateLoginCode(): string {
  return String(randomInt(100000, 1000000));
}

export async function hashPasscode(passcode: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(passcode, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPasscode(passcode: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64 ?? "", "base64");
  if (expected.length === 0) {
    return false;
  }
  const key = await scrypt(passcode, Buffer.from(saltB64 ?? "", "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** 共通ログイン用アカウントのメールアドレス（実在しない。メールは送らない） */
export function crewLoginEmail(organizationId: string): string {
  return `crew-${organizationId}@crew.kenbei.jp`;
}

export const CREW_DISPLAY_NAME = "作業員（共通ログイン）";
