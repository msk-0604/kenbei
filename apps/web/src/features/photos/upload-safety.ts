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
