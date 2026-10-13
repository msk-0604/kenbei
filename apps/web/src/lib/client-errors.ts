/** 画面に出す短い日本語のエラー（ブラウザ側の保存処理用） */

export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  message = "通信がタイムアウトしました。電波を確認してもう一度お試しください。",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function rawMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return fallback;
}

export function toSaveUserMessage(err: unknown, fallback = "保存に失敗しました"): string {
  const raw = rawMessage(err, fallback);
  const m = raw.toLowerCase();
  if (m.includes("タイムアウト") || m.includes("timeout")) {
    return "保存がタイムアウトしました。通信状況を確認して、もう一度お試しください。";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "通信に失敗しました。電波のよい場所でもう一度お試しください。";
  }
  if (m.includes("row-level security") || m.includes("rls") || m.includes("permission denied")) {
    return "保存する権限がありません。ログインし直してもう一度お試しください。";
  }
  if (m.includes("duplicate") || m.includes("unique")) {
    return "同じ内容がすでに登録されています。入力を確認してください。";
  }
  if (/[ぁ-んァ-ン一-龥]/.test(raw)) {
    return raw;
  }
  return `${fallback}。通信を確認してもう一度お試しください。`;
}
