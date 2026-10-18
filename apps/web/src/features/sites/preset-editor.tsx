"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { toSaveUserMessage, withTimeout } from "@/lib/client-errors";
import { STANDARD_PROGRESS_ITEMS } from "@/lib/standard-progress-items";
import { TRADE_TEMPLATES, tradeTemplate } from "@/lib/trade-progress-templates";
import type { ProgressPreset } from "@/features/sites/types";

type Row = ProgressPreset & { id: string };

/**
 * 「よく使う項目」を会社ごとに決める。
 * 何も登録しないうちは標準の候補（水道・管工事）を使う。業種が違う会社はここで作り直す。
 */
export function PresetEditor({ organizationId, initial }: { organizationId: string; initial: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState({ category: "", section: "", item_name: "" });
  const [busy, setBusy] = useState(false);
  const [trade, setTrade] = useState(TRADE_TEMPLATES[0]?.key ?? "plumbing");
  const [error, setError] = useState("");

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
      router.refresh();
    } catch (err) {
      setError(toSaveUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function reload(supabase: ReturnType<typeof createBrowserSupabaseClient>) {
    const { data, error: loadError } = await supabase
      .from("progress_item_presets")
      .select("id, category, section, item_name")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (loadError) {
      throw loadError;
    }
    setRows((data as Row[] | null) ?? []);
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const itemName = form.item_name.trim();
    if (!itemName) {
      setError("項目名を入れてください");
      return;
    }
    void run(async () => {
      const supabase = createBrowserSupabaseClient();
      const sortOrder = rows.length;
      const { error: insertError } = await withTimeout(
        supabase.from("progress_item_presets").insert({
          organization_id: organizationId,
          category: form.category.trim() || "その他",
          section: form.section.trim() || null,
          item_name: itemName,
          sort_order: sortOrder,
        }),
        20000,
      );
      if (insertError) {
        throw insertError;
      }
      setForm((prev) => ({ ...prev, item_name: "" }));
      await reload(supabase);
    });
  }

  function remove(row: Row) {
    if (!window.confirm(`「${row.item_name}」を候補から外しますか？（現場に入っている工程は消えません）`)) {
      return;
    }
    void run(async () => {
      const supabase = createBrowserSupabaseClient();
      const { error: deleteError } = await supabase
        .from("progress_item_presets")
        .delete()
        .eq("id", row.id)
        .eq("organization_id", organizationId);
      if (deleteError) {
        throw deleteError;
      }
      await reload(supabase);
    });
  }

  /** 業種の標準候補を読み込む。すでにある項目（分類・場所・項目名が同じもの）は足さない。 */
  function loadTrade() {
    const template = tradeTemplate(trade);
    if (!template) {
      return;
    }
    const keyOf = (item: ProgressPreset) => [item.category, item.section ?? "", item.item_name].join("\u0000");
    const have = new Set(rows.map(keyOf));
    const fresh = template.items.filter((item) => !have.has(keyOf(item)));
    if (fresh.length === 0) {
      setError(`${template.label}の候補はすべて入っています`);
      return;
    }
    void run(async () => {
      const supabase = createBrowserSupabaseClient();
      const { error: insertError } = await supabase.from("progress_item_presets").insert(
        fresh.map((item, index) => ({
          organization_id: organizationId,
          category: item.category,
          section: item.section,
          item_name: item.item_name,
          sort_order: rows.length + index,
        })),
      );
      if (insertError) {
        throw insertError;
      }
      await reload(supabase);
    });
  }

  const tradePicker = (
    <div className="space-y-3">
      <label className="block text-lg font-bold text-gray-800" htmlFor="preset-trade">
        業種
      </label>
      <select
        id="preset-trade"
        value={trade}
        onChange={(e) => setTrade(e.target.value)}
        className="min-h-14 w-full rounded-xl border-2 border-gray-300 bg-white px-3 text-lg"
      >
        {TRADE_TEMPLATES.map((template) => (
          <option key={template.key} value={template.key}>
            {template.label}（{template.items.length}件）
          </option>
        ))}
      </select>
      <Button type="button" variant="secondary" fullWidth loading={busy} onClick={loadTrade}>
        この業種の標準の候補を読み込む
      </Button>
    </div>
  );

  function resetToStandard() {
    if (!window.confirm("会社の候補をすべて消して、標準の候補（水道・管工事）に戻しますか？")) {
      return;
    }
    void run(async () => {
      const supabase = createBrowserSupabaseClient();
      const { error: deleteError } = await supabase
        .from("progress_item_presets")
        .delete()
        .eq("organization_id", organizationId);
      if (deleteError) {
        throw deleteError;
      }
      setRows([]);
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-lg text-red-700">{error}</p>
      ) : null}

      <Card>
        <h2 className="mb-4 text-xl font-bold text-navy-950">候補を追加する</h2>
        <form onSubmit={add} className="space-y-4">
          <Input
            label="分類（例：屋内・電気・内装）"
            id="preset-category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            maxLength={60}
          />
          <Input
            label="場所（任意。例：1階）"
            id="preset-section"
            value={form.section}
            onChange={(e) => setForm({ ...form, section: e.target.value })}
            maxLength={60}
          />
          <Input
            label="項目名（必須）"
            id="preset-name"
            value={form.item_name}
            onChange={(e) => setForm({ ...form, item_name: e.target.value })}
            maxLength={120}
            required
          />
          <Button type="submit" fullWidth loading={busy}>
            候補に追加する
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-2 text-xl font-bold text-navy-950">今の候補（{rows.length > 0 ? `${rows.length}件` : "標準"}）</h2>
        {rows.length === 0 ? (
          <div className="space-y-4">
            <p className="text-lg text-gray-700">
              まだ会社の候補はありません。いまは標準の候補（水道・管工事の工事進行表、{STANDARD_PROGRESS_ITEMS.length}
              件）を使っています。
            </p>
            <p className="text-lg text-gray-700">ほかの業種の会社は、業種を選んで読み込み、手直ししてください。</p>
            {tradePicker}
          </div>
        ) : (
          <>
            <ul className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-xl border-2 border-gray-200 px-3 py-2"
                >
                  <span className="min-w-0 text-lg">
                    <span className="text-gray-500">
                      {row.category}
                      {row.section ? ` / ${row.section}` : ""} /{" "}
                    </span>
                    <span className="font-bold text-gray-950">{row.item_name}</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(row)}
                    className="tap-press min-h-12 shrink-0 rounded-xl border-2 border-red-300 px-3 text-base font-bold text-red-700"
                  >
                    外す
                  </button>
                </li>
              ))}
            </ul>
            <details className="mt-4">
              <summary className="cursor-pointer text-lg font-bold text-gray-800">ほかの業種の候補を追加で読み込む</summary>
              <div className="mt-3">{tradePicker}</div>
            </details>
            <Button type="button" variant="danger" fullWidth className="mt-4" loading={busy} onClick={resetToStandard}>
              標準の候補に戻す
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
