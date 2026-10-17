/**
 * Excel で保存した CSV を読む（ブラウザでもサーバーでも動く）。
 * 日本語の Excel は「CSV」で保存すると Shift_JIS になるので、UTF-8 として読めなければ Shift_JIS で読み直す。
 */
export function decodeCsvBytes(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(view);
  } catch {
    text = new TextDecoder("shift_jis").decode(view);
  }
  return text.replace(/^﻿/, "");
}

/** RFC 4180 の CSV（"..." の中のカンマ・改行・"" に対応）。空行は捨てる。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/** ダウンロード用の CSV（Excel で文字化けしないよう BOM 付き UTF-8） */
export function toCsv(rows: string[][]): string {
  const escape = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return `﻿${rows.map((cells) => cells.map(escape).join(",")).join("\r\n")}\r\n`;
}
