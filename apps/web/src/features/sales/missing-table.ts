export function isUniqueSalesConstraint(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) {
    return false;
  }
  if (error.code === "23505") {
    return true;
  }
  return /duplicate key|unique constraint/i.test(error.message ?? "");
}

export function isMissingSalesTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error || isUniqueSalesConstraint(error)) {
    return false;
  }
  if (error.code === "42P01" || error.code === "PGRST205") {
    return true;
  }
  return /does not exist|schema cache/i.test(error.message ?? "");
}
