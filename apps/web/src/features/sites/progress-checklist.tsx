"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/client-errors";
import { readPersonName } from "@/lib/person-name";
import { cn } from "@/lib/cn";
import { formatMarkedAt } from "@/lib/site-dates";
import { notifyProcessChangeAction, setSiteStatusAction } from "@/features/sites/actions";
import {
  choiceFromMark,
  isProgressConflict,
  nextProgressChoice,
  normalizeMark,
  progressChoiceLabel,
  progressItemLabel,
  type SiteStatus,
} from "@/lib/site-rules";
import type { ProgressPreset, ProjectProgressItem } from "@/features/sites/types";
import { Button } from "@/components/ui/button";
import { ProcessPlanner } from "@/features/sites/process-planner";

type GroupedItems = {
  category: string;
  sections: { section: string | null; items: ProjectProgressItem[] }[];
};

function groupItems(items: ProjectProgressItem[]): GroupedItems[] {
  const categoryMap = new Map<
    string,
    Map<string | null, ProjectProgressItem[]>
  >();

  for (const item of items) {
    if (!item?.id || !item.item_name) continue;
    if (!categoryMap.has(item.category)) {
      categoryMap.set(item.category, new Map());
    }
    const sectionMap = categoryMap.get(item.category)!;
    const key = item.section;
    if (!sectionMap.has(key)) sectionMap.set(key, []);
    sectionMap.get(key)!.push(item);
  }

  return Array.from(categoryMap.entries()).map(([category, sectionMap]) => ({
    category,
    sections: Array.from(sectionMap.entries()).map(([section, sectionItems]) => ({
      section,
      items: sectionItems,
    })),
  }));
}

function itemKey(category: string, section: string | null, name: string) {
  return `${category}::${section ?? ""}::${name}`;
}

function friendlyDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("row-level security") || m.includes("permission")) {
    return "この現場の工程を変更する権限がありません。";
  }
  if (m.includes("check") || m.includes("constraint")) {
    return "保存内容が正しくありません。空欄のまま保存できる項目は空欄でも大丈夫です。もう一度お試しください。";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "通信に失敗しました。電波を確認して、もう一度お試しください。";
  }
  return "保存に失敗しました。もう一度お試しください。";
}

type SaveState = {
  status: "saving" | "saved" | "failed";
  message?: string;
  choice?: "ok" | "attention";
};

export function ProgressChecklist({
  items: initialItems,
  projectId,
  organizationId,
  presets,
  showPercent = true,
  canManageItems = true,
  canCompleteSite = false,
  notifyOnItemAdd = true,
  actorName = "",
  namesById = {},
  todayWork = "",
  siteStatus,
}: {
  items: ProjectProgressItem[];
  projectId: string;
  organizationId: string;
  /** 「よく使う項目」の候補（会社ごと。未登録なら標準候補） */
  presets: ProgressPreset[];
  showPercent?: boolean;
  canManageItems?: boolean;
  canCompleteSite?: boolean;
  notifyOnItemAdd?: boolean;
  /** 〇/△を押した人の名前（共通ログインでは端末で選んだ名前） */
  actorName?: string;
  namesById?: Record<string, string>;
  todayWork?: string;
  siteStatus?: SiteStatus;
}) {
  const router = useRouter();
  const [items, setItems] = useState(() =>
    (initialItems ?? []).map((item) => ({
      ...item,
      mark: normalizeMark(item.mark, item.checked),
      remarks: item.remarks ?? null,
    }))
  );
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [noticeRetry, setNoticeRetry] = useState<{ key: string; message: string } | null>(
    null
  );
  const [currentStatus, setCurrentStatus] = useState<SiteStatus | undefined>(siteStatus);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");

  const completed = items.filter((i) => normalizeMark(i.mark, i.checked) === "ok")
    .length;
  const attention = items.filter(
    (i) => normalizeMark(i.mark, i.checked) === "attention"
  ).length;
  const percent =
    items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

  const existingKeys = useMemo(
    () =>
      new Set(
        items.map((i) => itemKey(i.category, i.section, i.item_name))
      ),
    [items]
  );

  const palette = useMemo(
    () =>
      presets.filter(
        (p) =>
          p.item_name.trim() &&
          !existingKeys.has(itemKey(p.category, p.section, p.item_name))
      ),
    [existingKeys, presets]
  );

  async function setMark(item: ProjectProgressItem, mark: "ok" | "attention") {
    const currentChoice = choiceFromMark(normalizeMark(item.mark, item.checked));
    const pressed = mark === "ok" ? "complete" : "incomplete";
    if (nextProgressChoice(currentChoice, pressed) == null) return;

    setBannerError("");
    setSaveState((prev) => ({ ...prev, [item.id]: { status: "saving", choice: mark } }));
    const expectedVersion = item.version ?? 1;
    let data: ProjectProgressItem | ProjectProgressItem[] | null = null;
    let error: { message: string } | null = null;
    try {
      const supabase = createBrowserSupabaseClient();
      const result = await withTimeout(
        supabase.rpc("set_progress_mark", {
          p_item_id: item.id,
          p_mark: mark,
          p_expected_version: expectedVersion,
          p_actor_name: actorName || readPersonName() || null,
        }),
        20000,
        "保存がタイムアウトしました。通信を確認して、もう一度押してください。"
      );
      data = result.data;
      error = result.error;
    } catch (err) {
      error = { message: err instanceof Error ? err.message : "保存に失敗しました" };
    }

    if (error || !data) {
      const message = error?.message || "保存に失敗しました";
      setSaveState((prev) => ({
        ...prev,
        [item.id]: {
          status: "failed",
          choice: mark,
          message: isProgressConflict(message)
            ? "ほかの人が先に更新しました。最新の内容を読み込みます。"
            : "保存できていません。通信を確認して、もう一度押してください。",
        },
      }));
      if (error && isProgressConflict(error.message)) router.refresh();
      return;
    }

    const row = (Array.isArray(data) ? data[0] : data) as ProjectProgressItem;
    setItems((prev) =>
      prev.map((current) =>
        current.id === item.id
          ? {
              ...current,
              ...row,
              mark: normalizeMark(row.mark, row.checked),
              remarks: row.remarks ?? current.remarks,
            }
          : current
      )
    );
    setSaveState((prev) => ({ ...prev, [item.id]: { status: "saved" } }));
  }

  async function tellAssignees(actionKey: string) {
    const response = await notifyProcessChangeAction(projectId, actionKey).catch(() => ({ ok: false }));
    if (!response.ok) {
      setNoticeRetry({
        key: actionKey,
        message: "工程は保存されています。ほかの人へのお知らせだけ失敗しました。",
      });
      return;
    }
    setNoticeRetry(null);
  }

  async function moveItem(item: ProjectProgressItem, direction: -1 | 1) {
    const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const index = ordered.findIndex((row) => row.id === item.id);
    const neighbor = ordered[index + direction];
    if (!neighbor) return;
    const first = item.sort_order;
    const second = neighbor.sort_order;

    setBannerError("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await withTimeout(
        supabase
          .from("project_progress_items")
          .update({ sort_order: second })
          .eq("id", item.id)
          .eq("organization_id", organizationId),
        20000,
        "並び順の保存がタイムアウトしました。通信を確認して、もう一度お試しください。"
      );
      if (error) {
        setBannerError("順番を保存できていません。もう一度押してください。");
        return;
      }
      const secondUpdate = await withTimeout(
        supabase
          .from("project_progress_items")
          .update({ sort_order: first })
          .eq("id", neighbor.id)
          .eq("organization_id", organizationId),
        20000,
        "並び順の保存がタイムアウトしました。通信を確認して、もう一度お試しください。"
      );
      if (secondUpdate.error) {
        setBannerError("順番を保存できていません。もう一度押してください。");
        return;
      }
    } catch (err) {
      setBannerError(
        err instanceof Error
          ? err.message
          : "順番を保存できていません。もう一度押してください。"
      );
      return;
    }

    setItems((prev) =>
      prev.map((row) => {
        if (row.id === item.id) return { ...row, sort_order: second };
        if (row.id === neighbor.id) return { ...row, sort_order: first };
        return row;
      })
    );
  }

  async function removeItem(item: ProjectProgressItem) {
    if (!window.confirm(`「${item.item_name}」を削除しますか？`)) return;
    setBannerError("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await withTimeout(
        supabase
          .from("project_progress_items")
          .delete()
          .eq("id", item.id)
          .eq("organization_id", organizationId),
        20000,
        "削除がタイムアウトしました。通信を確認して、もう一度お試しください。"
      );
      if (error) {
        setBannerError("削除できていません。もう一度押してください。");
        return;
      }
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : "削除できていません。もう一度押してください。"
      );
      return;
    }
    setItems((prev) => prev.filter((row) => row.id !== item.id));
    if (notifyOnItemAdd) {
      await tellAssignees(`delete-${item.id}`);
    }
  }

  async function addProcess(process: {
    category: string;
    section: string | null;
    item_name: string;
  }) {
    const name = process.item_name?.trim();
    if (!name || !organizationId || !projectId) return;

    const key = itemKey(process.category, process.section, name);
    if (existingKeys.has(key) || addingKey) return;

    setBannerError("");
    setAddingKey(key);
    const sortOrder =
      items.reduce((min, i) => Math.min(min, i.sort_order ?? 0), 0) - 1;

    const fullRow = {
      organization_id: organizationId,
      project_id: projectId,
      category: process.category || "その他",
      section: process.section,
      item_name: name,
      sort_order: sortOrder,
    };

    let data: ProjectProgressItem | null = null;
    let error: { message: string } | null = null;
    try {
      const supabase = createBrowserSupabaseClient();
      const result = await withTimeout(
        supabase.from("project_progress_items").insert(fullRow).select("*").single(),
        20000,
        "工程の追加がタイムアウトしました。通信を確認して、もう一度お試しください。"
      );
      data = result.data as ProjectProgressItem | null;
      error = result.error;
    } catch (err) {
      error = { message: err instanceof Error ? err.message : "工程の追加に失敗しました" };
    } finally {
      setAddingKey(null);
    }

    if (error || !data) {
      setBannerError(friendlyDbError(error?.message || "工程の追加に失敗しました"));
      return;
    }

    setItems((prev) => [
      {
        ...data,
        mark: normalizeMark(data.mark, data.checked),
        remarks: data.remarks ?? null,
        version: data.version ?? 1,
      } as ProjectProgressItem,
      ...prev,
    ]);
    if (notifyOnItemAdd) {
      await tellAssignees(data.id);
    }
    router.refresh();
  }

  async function completeSite() {
    setCompleting(true);
    setCompleteError("");
    try {
      const result = await setSiteStatusAction(projectId, "completed");
      if (!result.ok) {
        throw new Error(result.error);
      }
      setCurrentStatus("completed");
      router.refresh();
    } catch (err) {
      setCompleteError(
        err instanceof Error ? err.message : "更新に失敗しました"
      );
    } finally {
      setCompleting(false);
    }
  }

  const grouped = groupItems(items);

  return (
    <div className="space-y-8">
      {bannerError ? (
        <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-lg text-red-700">
          {bannerError}
        </p>
      ) : null}

      {todayWork ? (
        <section className="rounded-2xl border-2 border-gray-900 bg-white p-4">
          <p className="text-base font-bold text-gray-600">今日の作業</p>
          <p className="mt-1 whitespace-pre-wrap text-xl font-bold text-gray-950">
            {todayWork}
          </p>
        </section>
      ) : null}

      {noticeRetry ? (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4">
          <p className="text-lg text-red-800">{noticeRetry.message}</p>
          <button
            type="button"
            className="mt-3 min-h-14 rounded-2xl bg-gray-900 px-4 text-lg font-bold text-white"
            onClick={() => void tellAssignees(noticeRetry.key)}
          >
            お知らせを再送する
          </button>
        </div>
      ) : null}
      {showPercent ? (
        <section className="rounded-2xl border-2 border-navy-900 bg-navy-900 p-5 text-center text-white">
          <p className="text-base font-bold opacity-90">進捗状況</p>
          <p className="mt-2 text-5xl font-bold">{percent}%</p>
          <p className="mt-2 text-base opacity-90">
            〇 {completed}件 / △ {attention}件 / 全{items.length}件
          </p>
          <div className="mt-4 h-4 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </section>
      ) : null}

      {canCompleteSite &&
      items.length > 0 &&
      percent === 100 &&
      currentStatus &&
      currentStatus !== "completed" ? (
        <section className="rounded-2xl border-2 border-green-700 bg-green-50 p-4">
          <p className="text-lg font-bold text-green-900">
            全ての項目が完了しました。この現場を完了にしますか？
          </p>
          {completeError ? (
            <p className="mt-2 text-base font-bold text-red-700">
              {completeError}
            </p>
          ) : null}
          <Button
            type="button"
            fullWidth
            loading={completing}
            onClick={() => void completeSite()}
            className="mt-3"
          >
            この現場を完了にする
          </Button>
        </section>
      ) : null}

      {currentStatus === "completed" ? (
        <section className="rounded-2xl border-2 border-gray-300 bg-gray-50 p-4">
          <p className="text-lg font-bold text-gray-800">
            この現場は完了になっています
          </p>
        </section>
      ) : null}

      {canManageItems ? (
        <ProcessPlanner onAdd={addProcess} />
      ) : null}

      {canManageItems ? (
        <section className="rounded-2xl border-2 border-gray-200 bg-white p-4">
          <h2 className="text-lg font-bold text-navy-950">
            よく使う項目を追加する
          </h2>
          <p className="mt-1 text-base text-gray-600">
            毎回打たなくて大丈夫です。一覧をタップ（またはドラッグ）して追加します。
          </p>
          {palette.length === 0 ? (
            <p className="mt-4 text-base text-gray-500">
              追加できる項目はすべて入っています。
            </p>
          ) : (
            <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {palette.map((process) => {
                const key = itemKey(
                  process.category,
                  process.section,
                  process.item_name
                );
                const label = process.section
                  ? `${process.category} / ${process.section} / ${process.item_name}`
                  : `${process.category} / ${process.item_name}`;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      draggable
                      disabled={addingKey === key}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "application/kenbei-process",
                          JSON.stringify(process)
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => void addProcess(process)}
                      className="tap-press flex min-h-[3.5rem] w-full items-center rounded-xl border-2 border-gray-200 bg-gray-50 px-4 text-left text-base font-bold text-navy-950 active:bg-navy-900 active:text-white"
                    >
                      {addingKey === key ? "追加中…" : `＋ ${label}`}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      <section
        className={cn(
          "rounded-2xl border-2 border-dashed p-4 transition-colors",
          canManageItems && dropActive
            ? "border-navy-900 bg-navy-900/5"
            : "border-gray-300 bg-white"
        )}
        onDragOver={(e) => {
          if (!canManageItems) return;
          e.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          if (!canManageItems) return;
          e.preventDefault();
          setDropActive(false);
          const raw = e.dataTransfer.getData("application/kenbei-process");
          if (!raw) return;
          try {
            const process = JSON.parse(raw) as {
              category: string;
              section: string | null;
              item_name: string;
            };
            if (process?.item_name?.trim()) void addProcess(process);
          } catch {
            // ignore bad drag payload
          }
        }}
      >
        <h2 className="text-lg font-bold text-navy-950">この現場の作業工程</h2>
        <p className="mt-1 text-base text-gray-600">
          {canManageItems
            ? "下の一覧から選んで追加できます。パソコンならドラッグ＆ドロップでも追加できます。"
            : "管理者が作成した工程に対して、作業者は〇/△で進捗を記録します。"}
        </p>

        {items.length === 0 ? (
          <p className="mt-4 text-lg text-gray-500">
            まだ工程がありません。下から追加してください。
          </p>
        ) : (
          <div className="mt-4 space-y-6">
            {grouped.map((group) => (
              <div key={group.category}>
                <h3 className="mb-3 text-lg font-bold text-navy-950">
                  {group.category}
                </h3>
                {group.sections.map((sec) => (
                  <div key={sec.section ?? "default"} className="mb-4">
                    {sec.section ? (
                      <h4 className="mb-2 text-base font-bold text-gray-600">
                        {sec.section}
                      </h4>
                    ) : null}
                    <ul className="space-y-3">
                      {sec.items.map((item) => {
                        const mark = normalizeMark(item.mark, item.checked);
                        const choice = choiceFromMark(mark, item.checked);
                        const state = saveState[item.id];
                        const label = progressItemLabel(item);
                        const who =
                          item.checked_by_name ||
                          (item.checked_by ? namesById[item.checked_by] || "担当者" : "");
                        return (
                          <li
                            key={item.id}
                            className="rounded-2xl border-2 border-gray-200 bg-white p-3"
                          >
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="min-w-40 flex-1">
                                <p className="break-words text-lg font-bold leading-snug text-gray-950">
                                  {label}
                                </p>
                                <p className="mt-1 text-base font-bold text-gray-700">
                                  {progressChoiceLabel(choice)}
                                  {who && item.checked_at ? `　${who} ${formatMarkedAt(item.checked_at)}` : ""}
                                </p>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <button
                                  type="button"
                                  disabled={state?.status === "saving"}
                                  onClick={() => void setMark(item, "ok")}
                                  className={cn(
                                    "min-h-14 min-w-24 rounded-2xl border-2 px-3 text-base font-bold",
                                    choice === "complete"
                                      ? "border-green-700 bg-green-700 text-white"
                                      : "border-green-700 bg-white text-green-800"
                                  )}
                                >
                                  ○ 完了
                                </button>
                                <button
                                  type="button"
                                  disabled={state?.status === "saving"}
                                  onClick={() => void setMark(item, "attention")}
                                  className={cn(
                                    "min-h-14 min-w-28 rounded-2xl border-2 px-3 text-base font-bold",
                                    choice === "incomplete"
                                      ? "border-amber-700 bg-amber-600 text-white"
                                      : "border-amber-700 bg-white text-amber-900"
                                  )}
                                >
                                  △ 未完了
                                </button>
                              </div>
                            </div>
                            {state?.status === "saving" ? (
                              <p className="mt-2 text-base font-bold text-gray-700">保存中</p>
                            ) : null}
                            {state?.status === "saved" ? (
                              <p className="mt-2 text-base font-bold text-green-800">保存済み</p>
                            ) : null}
                            {state?.status === "failed" ? (
                              <div className="mt-2">
                                <p className="text-base font-bold text-red-700">
                                  {state.message}
                                </p>
                                <button
                                  type="button"
                                  className="mt-2 min-h-14 rounded-2xl border-2 border-gray-900 px-4 text-base font-bold"
                                  onClick={() =>
                                    void setMark(item, state.choice ?? "ok")
                                  }
                                >
                                  もう一度保存する
                                </button>
                              </div>
                            ) : null}
                            {canManageItems ? (
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                <button
                                  type="button"
                                  className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-gray-300 text-sm font-bold leading-tight"
                                  onClick={() => void moveItem(item, -1)}
                                >
                                  <ArrowUp className="h-4 w-4" aria-hidden />
                                  並び順を上へ
                                </button>
                                <button
                                  type="button"
                                  className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-gray-300 text-sm font-bold leading-tight"
                                  onClick={() => void moveItem(item, 1)}
                                >
                                  <ArrowDown className="h-4 w-4" aria-hidden />
                                  並び順を下へ
                                </button>
                                <button
                                  type="button"
                                  className="min-h-14 rounded-2xl border-2 border-red-300 text-base font-bold text-red-700"
                                  onClick={() => void removeItem(item)}
                                >
                                  削除
                                </button>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
