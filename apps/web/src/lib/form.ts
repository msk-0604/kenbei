export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function formOptionalDate(formData: FormData, key: string): string | null {
  const value = formString(formData, key);
  return value === "" ? null : value;
}

export function formNumber(formData: FormData, key: string): number | null {
  const value = formString(formData, key);
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
