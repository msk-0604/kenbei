import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FONT_FILE = "NotoSansJP-Regular.ttf";

export function isSupportedPdfFontPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith(".ttf") || lower.endsWith(".otf");
}

export function isVariableOpenTypeFont(bytes: Buffer): boolean {
  if (bytes.length < 28) {
    return false;
  }
  const tableCount = bytes.readUInt16BE(4);
  for (let index = 0; index < tableCount; index += 1) {
    const offset = 12 + index * 16;
    if (offset + 4 > bytes.length) {
      break;
    }
    if (bytes.toString("ascii", offset, offset + 4) === "fvar") {
      return true;
    }
  }
  return false;
}

function fontNamesUnder(dir: string): string[] {
  return [path.join(dir, "fonts", FONT_FILE), path.join(dir, "apps", "web", "fonts", FONT_FILE)];
}

function walkDirs(start: string, depth = 5): string[] {
  const dirs = [start];
  let current = start;
  for (let index = 0; index < depth; index += 1) {
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    dirs.push(parent);
    current = parent;
  }
  return dirs;
}

export function pdfFontCandidates(envPath: string | undefined, cwd = process.cwd()): string[] {
  const extra = envPath?.trim() ? [envPath.trim()] : [];
  const lambdaRoot = process.env.LAMBDA_TASK_ROOT?.trim();
  const fromModule = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "fonts", FONT_FILE);
  const cwdFonts = path.join(cwd, "fonts", FONT_FILE);
  return [
    ...extra,
    cwdFonts,
    ...walkDirs(cwd).flatMap(fontNamesUnder),
    ...(lambdaRoot ? fontNamesUnder(lambdaRoot) : []),
    ...["/var/task", "/var/task/apps/web"].flatMap(fontNamesUnder),
    fromModule,
  ];
}

export function resolvePdfFontFile(envPath = process.env.PDF_FONT_PATH, cwd = process.cwd()): string | null {
  const seen = new Set<string>();
  for (const candidate of pdfFontCandidates(envPath, cwd)) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    if (!isSupportedPdfFontPath(resolved) || !existsSync(resolved)) {
      continue;
    }
    try {
      const bytes = readFileSync(resolved);
      if (bytes.byteLength > 1000) {
        return resolved;
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
