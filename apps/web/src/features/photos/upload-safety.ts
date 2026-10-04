export function isExistingStorageObject(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("already exists") ||
    text.includes("duplicate") ||
    text.includes("the resource already")
  );
}

export function isUniqueConstraintError(error: { code?: string | null; message?: string | null }): boolean {
  return error.code === "23505" || Boolean(error.message?.toLowerCase().includes("duplicate key"));
}

/**
 * Turns a storage / database error into a reason the user (and support) can
 * act on, instead of the generic "check your connection" message.
 */
export function photoSaveErrorMessage(raw: string | null | undefined): string {
  const text = (raw ?? "").toLowerCase();
  if (!text) {
    return "写真を保存できませんでした。通信状況を確認して、もう一度押してください。";
  }
  if (text.includes("row-level security") || text.includes("rls") || text.includes("unauthorized") || text.includes("403")) {
    return "この現場に写真を保存する権限が確認できませんでした。一度ログアウトして、ログインし直してください。（原因: 権限）";
  }
  if (text.includes("jwt") || text.includes("token") || text.includes("session")) {
    return "ログインの有効期限が切れました。ログインし直してから、もう一度保存してください。（原因: ログイン）";
  }
  if (text.includes("bucket")) {
    return "写真の保存先が見つかりませんでした。管理者にお問い合わせください。（原因: 保存先）";
  }
  if (text.includes("size") || text.includes("too large") || text.includes("413")) {
    return "写真のサイズが大きすぎます。枚数を減らすか、別の写真で試してください。（原因: サイズ）";
  }
  if (text.includes("mime") || text.includes("content type")) {
    return "この形式の写真は保存できません。JPEG・PNG・WebP の写真を選んでください。（原因: 形式）";
  }
  if (text.includes("failed to fetch") || text.includes("network") || text.includes("load failed")) {
    return "通信が切れたため保存できませんでした。電波のよい場所で、もう一度押してください。（原因: 通信）";
  }
  if (/[぀-ヿ一-龯]/.test(raw ?? "")) {
    return raw ?? "";
  }
  return `写真を保存できませんでした。（原因: ${(raw ?? "").slice(0, 80)}）`;
}
