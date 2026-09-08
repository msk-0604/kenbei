import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { loadPdfFontBytes } from "./pdf-font";

export function pdfFailed(value: Uint8Array | { error: string }): value is { error: string } {
  return !(value instanceof Uint8Array) && "error" in value;
}

export function needsJapaneseFont(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
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
  let font;
  try {
    if (!fontBytes) {
      font = await doc.embedFont(StandardFonts.Helvetica);
    } else {
      font = await doc.embedFont(fontBytes, { subset: true });
    }
  } catch {
    return { error: "日本語フォントをPDFに埋め込めませんでした。TTF/OTF（Variable Font可）を確認してください。" };
  }
  const pageSize: [number, number] = [595.28, 841.89];
  let page = doc.addPage(pageSize);
  let y = 790;
  const draw = (text: string, size: number) => {
    if (y < 64) {
      page = doc.addPage(pageSize);
      y = 790;
    }
    page.drawText(text.slice(0, 90) || " ", {
      x: 48,
      y,
      size,
      font,
      color: rgb(0.07, 0.07, 0.08),
    });
    y -= size + 8;
  };
  draw(title, 16);
  for (const line of lines) {
    draw(line || " ", 11);
  }
  return doc.save();
}
