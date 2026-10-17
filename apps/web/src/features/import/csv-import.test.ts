import { describe, expect, it } from "vitest";
import { decodeCsvBytes, parseCsv, toCsv } from "@/lib/csv";
import { IMPORT_MAX_ROWS, importTemplate, parseImportDate, readSiteRows, readWorkerRows } from "./csv-import";

describe("parseCsv", () => {
  it("handles quotes, commas, newlines and CRLF", () => {
    expect(parseCsv('名前,メモ\r\n"山田, 太郎","1行目\n2行目"\r\n"""引用""",x\r\n\r\n')).toEqual([
      ["名前", "メモ"],
      ["山田, 太郎", "1行目\n2行目"],
      ['"引用"', "x"],
    ]);
  });

  it("round-trips with toCsv", () => {
    const rows = [["a,b", 'c"d'], ["e", "f\ng"]];
    expect(parseCsv(toCsv(rows).replace(/^﻿/, ""))).toEqual(rows);
  });
});

describe("decodeCsvBytes", () => {
  it("reads UTF-8 with BOM", () => {
    const bytes = new TextEncoder().encode("﻿名前\n田中");
    expect(decodeCsvBytes(bytes)).toBe("名前\n田中");
  });

  it("falls back to Shift_JIS (Excel default)", () => {
    // 「名前」 in Shift_JIS
    const sjis = new Uint8Array([0x96, 0xbc, 0x91, 0x4f]);
    expect(decodeCsvBytes(sjis)).toBe("名前");
  });
});

describe("parseImportDate", () => {
  it("accepts common Japanese formats", () => {
    expect(parseImportDate("2026/10/1")).toBe("2026-10-01");
    expect(parseImportDate("2026-10-01")).toBe("2026-10-01");
    expect(parseImportDate("2026年10月1日")).toBe("2026-10-01");
    expect(parseImportDate("２０２６／１０／１")).toBe("2026-10-01");
    expect(parseImportDate(null)).toBeNull();
  });

  it("rejects impossible dates", () => {
    expect(parseImportDate("2026/2/30")).toBeUndefined();
    expect(parseImportDate("来週")).toBeUndefined();
  });
});

describe("readWorkerRows", () => {
  it("reads rows by header aliases", () => {
    const result = readWorkerRows([
      ["氏名", "携帯", "職種"],
      ["田中", "090-0000-0000", "配管"],
      ["", "", ""],
      ["田中", "", ""],
      ["佐藤", "", ""],
    ]);
    expect(result.rows).toEqual([
      { name: "田中", phone: "090-0000-0000", trade: "配管" },
      { name: "佐藤", phone: null, trade: null },
    ]);
    expect(result.issues).toEqual([
      { line: 3, message: "名前が空です" },
      { line: 4, message: "「田中」が重複しています" },
    ]);
  });

  it("reports a missing name column", () => {
    expect(readWorkerRows([["電話番号"], ["090"]]).missingHeaders).toEqual(["名前"]);
  });

  it("limits the number of rows", () => {
    const body = Array.from({ length: IMPORT_MAX_ROWS + 5 }, (_, i) => [`作業員${i}`]);
    const result = readWorkerRows([["名前"], ...body]);
    expect(result.rows).toHaveLength(IMPORT_MAX_ROWS);
    expect(result.issues[0]?.line).toBe(0);
  });
});

describe("readSiteRows", () => {
  it("reads the template", () => {
    const result = readSiteRows(importTemplate("sites"));
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      name: "〇〇様邸 給排水工事",
      start_date: "2026-11-01",
      end_date: "2026-11-20",
      work_duration: "long_term",
      prime_contractor_name: "〇〇建設",
    });
  });

  it("validates dates and duration", () => {
    const result = readSiteRows([
      ["現場名", "着工日", "完了予定日", "種類"],
      ["A", "2026/11/5", "2026/11/1", ""],
      ["B", "あした", "", ""],
      ["C", "", "", "たぶん"],
      ["D", "2026/11/1", "", "単発"],
    ]);
    expect(result.issues.map((issue) => issue.line)).toEqual([2, 3, 4]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ name: "D", work_duration: "one_off" });
  });

  it("reads the worker template", () => {
    expect(readWorkerRows(importTemplate("workers")).rows).toHaveLength(1);
  });
});
