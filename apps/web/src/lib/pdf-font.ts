import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function isSupportedPdfFontPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith(".ttf") || lower.endsWith(".otf");
}

export function pdfFontCandidates(envPath: string | undefined, cwd = process.cwd()): string[] {
  const extra = envPath?.trim() ? [envPath.trim()] : [];
  return [
    ...extra,
    path.join(cwd, "fonts", "NotoSansJP-Regular.ttf"),
    path.join(cwd, "apps", "web", "fonts", "NotoSansJP-Regular.ttf"),
  ];
}

export function resolvePdfFontFile(envPath = process.env.PDF_FONT_PATH, cwd = process.cwd()): string | null {
  for (const candidate of pdfFontCandidates(envPath, cwd)) {
    if (!isSupportedPdfFontPath(candidate) || !existsSync(candidate)) {
      continue;
    }
    try {
      const bytes = readFileSync(candidate);
      if (bytes.byteLength > 1000) {
        return candidate;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function loadPdfFontBytes(envPath = process.env.PDF_FONT_PATH, cwd = process.cwd()): Buffer | null {
  const file = resolvePdfFontFile(envPath, cwd);
  if (!file) {
    return null;
  }
  try {
    return readFileSync(file);
  } catch {
    return null;
  }
}
