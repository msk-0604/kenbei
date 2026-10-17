/**
 * 作業員・現場の CSV 取り込み（1行目は見出し）。
 * 見出しの名前は多少ゆれても読めるようにする（「名前」「氏名」など）。
 */

export const IMPORT_MAX_ROWS = 300;

export type ImportKind = "workers" | "sites";

export type WorkerImportRow = { name: string; phone: string | null; trade: string | null };

export type SiteImportRow = {
  name: string;
  address: string | null;
  prime_contractor_name: string | null;
  customer_name: string | null;
  work_type: string | null;
  manager_name: string | null;
  start_date: string | null;
  end_date: string | null;
  work_duration: "long_term" | "one_off" | null;
  memo: string | null;
};

export type ImportIssue = { line: number; message: string };

export type ImportResult<T> = { rows: T[]; issues: ImportIssue[]; missingHeaders: string[] };

type Column<K extends string> = { key: K; label: string; aliases: string[]; required?: boolean };

export const WORKER_COLUMNS: Column<"name" | "phone" | "trade">[] = [
  { key: "name", label: "名前", aliases: ["名前", "氏名", "作業員", "作業員名", "name"], required: true },
  { key: "phone", label: "電話番号", aliases: ["電話番号", "電話", "携帯", "携帯番号", "tel", "phone"] },
  { key: "trade", label: "職種", aliases: ["職種", "担当", "工種", "trade"] },
];

export const SITE_COLUMNS: Column<
  "name" | "address" | "prime" | "customer" | "work_type" | "manager" | "start" | "end" | "duration" | "memo"
>[] = [
  { key: "name", label: "現場名", aliases: ["現場名", "現場", "工事名", "件名", "name"], required: true },
  { key: "address", label: "住所", aliases: ["住所", "現場住所", "所在地", "場所"] },
  { key: "prime", label: "元請け", aliases: ["元請け", "元請", "元請会社", "元請け会社"] },
  { key: "customer", label: "お客様", aliases: ["お客様", "施主", "顧客", "依頼元", "お客様名"] },
  { key: "work_type", label: "工事内容", aliases: ["工事内容", "工事種別", "工種", "内容"] },
  { key: "manager", label: "担当者", aliases: ["担当者", "担当", "現場担当", "責任者"] },
  { key: "start", label: "着工日", aliases: ["着工日", "開始日", "着手日", "工期開始"] },
  { key: "end", label: "完了予定日", aliases: ["完了予定日", "完了日", "終了日", "竣工日", "工期終了"] },
  { key: "duration", label: "種類", aliases: ["種類", "長期/単発", "期間"] },
  { key: "memo", label: "メモ", aliases: ["メモ", "備考", "注意事項"] },
];

function normalizeHeader(value: string): string {
  return value.replace(/[\s　（）()・]/g, "").toLowerCase();
}

function headerIndex<K extends string>(header: string[], columns: Column<K>[]): { index: Partial<Record<K, number>>; missing: string[] } {
  const normalized = header.map(normalizeHeader);
  const index: Partial<Record<K, number>> = {};
  const missing: string[] = [];
  for (const column of columns) {
    const at = normalized.findIndex((cell) => column.aliases.some((alias) => normalizeHeader(alias) === cell));
    if (at >= 0) {
      index[column.key] = at;
    } else if (column.required) {
      missing.push(column.label);
    }
  }
  return { index, missing };
}

function cell(row: string[], at: number | undefined, max: number): string | null {
  if (at == null) {
    return null;
  }
  const value = (row[at] ?? "").trim();
  return value ? value.slice(0, max) : null;
}

/** 全角数字を半角に */
function toHalfWidth(value: string): string {
  return value.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).replace(/[／－ー]/g, "-");
}

/** 2026/10/1・2026-10-01・2026年10月1日 → 2026-10-01。読めなければ undefined。 */
export function parseImportDate(raw: string | null): string | null | undefined {
  if (!raw) {
    return null;
  }
  const value = toHalfWidth(raw).replace(/[年月]/g, "-").replace(/日/g, "").replace(/\//g, "-").trim();
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (!match) {
    return undefined;
  }
  const [, y = "", m = "", d = ""] = match;
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    return undefined;
  }
  return iso;
}

function parseDuration(raw: string | null): SiteImportRow["work_duration"] | undefined {
  if (!raw) {
    return null;
  }
  if (/単発|スポット|一日|1日/.test(raw)) {
    return "one_off";
  }
  if (/長期|継続/.test(raw)) {
    return "long_term";
  }
  return undefined;
}

function tooMany(count: number): ImportIssue[] {
  return count > IMPORT_MAX_ROWS ? [{ line: 0, message: `一度に取り込めるのは${IMPORT_MAX_ROWS}件までです。ファイルを分けてください。` }] : [];
}

export function readWorkerRows(table: string[][]): ImportResult<WorkerImportRow> {
  const [header = [], ...body] = table;
  const { index, missing } = headerIndex(header, WORKER_COLUMNS);
  if (missing.length > 0) {
    return { rows: [], issues: [], missingHeaders: missing };
  }
  const rows: WorkerImportRow[] = [];
  const issues: ImportIssue[] = tooMany(body.length);
  const seen = new Set<string>();
  body.slice(0, IMPORT_MAX_ROWS).forEach((row, i) => {
    const line = i + 2;
    const name = cell(row, index.name, 100);
    if (!name) {
      issues.push({ line, message: "名前が空です" });
      return;
    }
    if (seen.has(name)) {
      issues.push({ line, message: `「${name}」が重複しています` });
      return;
    }
    seen.add(name);
    rows.push({ name, phone: cell(row, index.phone, 30), trade: cell(row, index.trade, 50) });
  });
  return { rows, issues, missingHeaders: [] };
}

export function readSiteRows(table: string[][]): ImportResult<SiteImportRow> {
  const [header = [], ...body] = table;
  const { index, missing } = headerIndex(header, SITE_COLUMNS);
  if (missing.length > 0) {
    return { rows: [], issues: [], missingHeaders: missing };
  }
  const rows: SiteImportRow[] = [];
  const issues: ImportIssue[] = tooMany(body.length);
  const seen = new Set<string>();
  body.slice(0, IMPORT_MAX_ROWS).forEach((row, i) => {
    const line = i + 2;
    const name = cell(row, index.name, 200);
    if (!name) {
      issues.push({ line, message: "現場名が空です" });
      return;
    }
    if (seen.has(name)) {
      issues.push({ line, message: `「${name}」が重複しています` });
      return;
    }
    const start = parseImportDate(cell(row, index.start, 20));
    const end = parseImportDate(cell(row, index.end, 20));
    if (start === undefined || end === undefined) {
      issues.push({ line, message: "日付は 2026/10/1 の形で入れてください" });
      return;
    }
    if (start && end && start > end) {
      issues.push({ line, message: "完了予定日が着工日より前です" });
      return;
    }
    const duration = parseDuration(cell(row, index.duration, 20));
    if (duration === undefined) {
      issues.push({ line, message: "種類は「長期」か「単発」にしてください" });
      return;
    }
    seen.add(name);
    rows.push({
      name,
      address: cell(row, index.address, 500),
      prime_contractor_name: cell(row, index.prime, 200),
      customer_name: cell(row, index.customer, 200),
      work_type: cell(row, index.work_type, 50),
      manager_name: cell(row, index.manager, 100),
      start_date: start,
      end_date: end,
      work_duration: duration,
      memo: cell(row, index.memo, 2000),
    });
  });
  return { rows, issues, missingHeaders: [] };
}

/** ひな形（見出しと記入例） */
export function importTemplate(kind: ImportKind): string[][] {
  if (kind === "workers") {
    return [WORKER_COLUMNS.map((c) => c.label), ["山田 太郎", "090-1234-5678", "配管"]];
  }
  return [
    SITE_COLUMNS.map((c) => c.label),
    ["〇〇様邸 給排水工事", "大阪市北区1-2-3", "〇〇建設", "〇〇様", "給排水", "山本", "2026/11/1", "2026/11/20", "長期", "駐車場なし"],
  ];
}
