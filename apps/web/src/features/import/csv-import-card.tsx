"use client";

import { useState, useTransition } from "react";
import { decodeCsvBytes, parseCsv, toCsv } from "@/lib/csv";
import { importSitesAction, importWorkersAction, type ImportActionResult } from "@/features/import/actions";
import {
  IMPORT_MAX_ROWS,
  importTemplate,
  readSiteRows,
  readWorkerRows,
  type ImportIssue,
  type ImportKind,
} from "@/features/import/csv-import";

const COPY: Record<ImportKind, { title: string; unit: string; file: string }> = {
  workers: { title: "作業員を取り込む", unit: "人", file: "kenbei-作業員ひな形.csv" },
  sites: { title: "現場を取り込む", unit: "件", file: "kenbei-現場ひな形.csv" },
};

type Preview = { table: string[][]; count: number; names: string[]; issues: ImportIssue[]; missing: string[] };

function downloadTemplate(kind: ImportKind) {
  const blob = new Blob([toCsv(importTemplate(kind))], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = COPY[kind].file;
  link.click();
  URL.revokeObjectURL(url);
}

export function CsvImportCard({ kind }: { kind: ImportKind }) {
  const copy = COPY[kind];
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportActionResult | null>(null);
  const [readError, setReadError] = useState("");
  const [pending, startTransition] = useTransition();

  async function onFile(file: File | undefined) {
    setPreview(null);
    setResult(null);
    setReadError("");
    if (!file) {
      return;
    }
    if (file.size > 1024 * 1024) {
      setReadError("ファイルが大きすぎます（1MB まで）。");
      return;
    }
    try {
      const table = parseCsv(decodeCsvBytes(await file.arrayBuffer()));
      const parsed = kind === "workers" ? readWorkerRows(table) : readSiteRows(table);
      setPreview({
        table,
        count: parsed.rows.length,
        names: parsed.rows.slice(0, 5).map((row) => row.name),
        issues: parsed.issues,
        missing: parsed.missingHeaders,
      });
    } catch {
      setReadError("ファイルを読めませんでした。Excel で「CSV」形式で保存したファイルを選んでください。");
    }
  }

  function submit() {
    if (!preview) {
      return;
    }
    startTransition(async () => {
      const action = kind === "workers" ? importWorkersAction : importSitesAction;
      setResult(await action(preview.table));
      setPreview(null);
    });
  }

  return (
    <section className="rounded-2xl border-2 border-gray-200 bg-white p-4">
      <h2 className="text-xl font-bold text-gray-950">{copy.title}</h2>
      <p className="mt-1 text-gray-700">
        Excel で作った一覧を「CSV」で保存して選んでください（1回 {IMPORT_MAX_ROWS}
        {copy.unit}まで）。同じ名前のものは飛ばします。
      </p>
      <button
        type="button"
        onClick={() => downloadTemplate(kind)}
        className="mt-3 text-base font-bold text-[var(--kb-accent)] underline"
      >
        ひな形（CSV）をダウンロード
      </button>
      <label className="mt-3 block">
        <span className="sr-only">CSV ファイル</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void onFile(event.target.files?.[0])}
          className="block w-full text-base file:mr-3 file:min-h-12 file:rounded-xl file:border-0 file:bg-gray-950 file:px-4 file:font-bold file:text-white"
        />
      </label>

      {readError ? (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-red-800" role="alert">
          {readError}
        </p>
      ) : null}

      {preview ? (
        <div className="mt-4 space-y-3">
          {preview.missing.length > 0 ? (
            <p className="rounded-xl bg-red-50 p-3 text-red-800" role="alert">
              1行目の見出しに「{preview.missing.join("」「")}」がありません。ひな形の見出しに合わせてください。
            </p>
          ) : (
            <>
              <p className="text-lg font-bold text-gray-950">
                {preview.count}
                {copy.unit}を登録できます
              </p>
              {preview.names.length > 0 ? (
                <p className="text-gray-700">
                  {preview.names.join("、")}
                  {preview.count > preview.names.length ? " ほか" : ""}
                </p>
              ) : null}
              {preview.issues.length > 0 ? (
                <ul className="rounded-xl bg-amber-50 p-3 text-amber-900">
                  {preview.issues.slice(0, 10).map((issue) => (
                    <li key={`${issue.line}-${issue.message}`}>
                      {issue.line > 0 ? `${issue.line}行目：` : ""}
                      {issue.message}（この行は登録しません）
                    </li>
                  ))}
                  {preview.issues.length > 10 ? <li>ほか {preview.issues.length - 10} 行</li> : null}
                </ul>
              ) : null}
              <button
                type="button"
                disabled={pending || preview.count === 0}
                onClick={submit}
                className="tap-press min-h-14 w-full rounded-2xl bg-gray-950 text-lg font-bold text-white disabled:opacity-50"
              >
                {pending ? "登録しています…" : `${preview.count}${copy.unit}を登録する`}
              </button>
            </>
          )}
        </div>
      ) : null}

      {result ? (
        result.ok ? (
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-emerald-900">
            {result.created}
            {copy.unit}を登録しました。
            {result.skipped.length > 0 ? `すでにある ${result.skipped.length}${copy.unit}（${result.skipped.slice(0, 3).join("、")}${result.skipped.length > 3 ? "…" : ""}）は飛ばしました。` : ""}
          </p>
        ) : (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-800" role="alert">
            {result.error}
          </p>
        )
      ) : null}
    </section>
  );
}
