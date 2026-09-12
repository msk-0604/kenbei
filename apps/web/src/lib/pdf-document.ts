import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { isVariableOpenTypeFont, loadPdfFontBytes } from "./pdf-font";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 48;

export function pdfFailed(value: Uint8Array | { error: string }): value is { error: string } {
  return !(value instanceof Uint8Array) && "error" in value;
}

export function needsJapaneseFont(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
}

export function sanitizePdfText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/** Grapheme-safe wrap using the same embedded font as drawText. */
export function wrapPdfLines(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const source = sanitizePdfText(text);
  if (!source) {
    return [" "];
  }
  const wrapped: string[] = [];
  for (const paragraph of source.split("\n")) {
    if (!paragraph) {
      wrapped.push(" ");
      continue;
    }
    let current = "";
    for (const char of [...paragraph]) {
      const next = current + char;
      const width = font.widthOfTextAtSize(next, size);
      if (width <= maxWidth || current.length === 0) {
        current = next;
        continue;
      }
      wrapped.push(current);
      current = char;
    }
    if (current) {
      wrapped.push(current);
    }
  }
  return wrapped.length > 0 ? wrapped : [" "];
}

export async function buildPdf(title: string, lines: string[]): Promise<Uint8Array | { error: string }> {
  const allText = [title, ...lines].join("\n");
  const fontBytes = loadPdfFontBytes();
  if (needsJapaneseFont(allText) && !fontBytes) {
    return {
      error:
        "日本語PDFには TTF/OTF フォントが必要です。apps/web/fonts/NotoSansJP-Regular.ttf をデプロイに含めてください（.ttc 不可）。文字化けしたPDFは出力しません。",
    };
  }
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  let font: PDFFont;
  try {
    if (!fontBytes) {
      font = await doc.embedFont(StandardFonts.Helvetica);
    } else {
      // fontkit subsetting of variable CJK fonts yields wrong advances (scattered glyphs).
      font = await doc.embedFont(fontBytes, { subset: !isVariableOpenTypeFont(fontBytes) });
    }
  } catch {
    return { error: "日本語フォントをPDFに埋め込めませんでした。TTF/OTF（Variable Font可）を確認してください。" };
  }
  const pageSize: [number, number] = [PAGE_WIDTH, PAGE_HEIGHT];
  const maxWidth = PAGE_WIDTH - PAGE_MARGIN * 2;
  let page = doc.addPage(pageSize);
  let y = 790;
  const draw = (text: string, size: number) => {
    for (const line of wrapPdfLines(font, text, size, maxWidth)) {
      if (y < 64) {
        page = doc.addPage(pageSize);
        y = 790;
      }
      page.drawText(line, {
        x: PAGE_MARGIN,
        y,
        size,
        font,
        color: rgb(0.07, 0.07, 0.08),
      });
      y -= size + 8;
    }
  };
  draw(title, 16);
  for (const line of lines) {
    draw(line || " ", 11);
  }
  return doc.save();
}
