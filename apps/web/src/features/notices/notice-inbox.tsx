"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export type NoticeItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export function NoticeInbox({
  initialItems,
  tableReady,
}: {
  initialItems: NoticeItem[];
  tableReady: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState("");

  async function openNotice(item: NoticeItem) {
    setError("");
    if (!item.read_at) {
      const supabase = createBrowserSupabaseClient();
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", item.id);
      if (updateError) {
        setError("既読の保存に失敗しました。通信を確認して、もう一度押してください。");
        return;
      }
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row
        )
      );
    }
    router.push(item.href && item.href.startsWith("/") && !item.href.startsWith("//") ? item.href : "/today");
  }

  if (!tableReady) {
    return (
      <p className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-4 text-lg text-amber-950">
        お知らせの保存先がまだ準備されていません。管理者に、データベースの更新を依頼してください。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-lg text-red-800">
          {error}
        </p>
      ) : null}
      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white px-4 py-10 text-center">
          <p className="text-2xl font-bold text-gray-900">お知らせはありません</p>
          <p className="mt-2 text-lg text-gray-600">
            新しい現場や、予定・作業工程の変更がここに残ります。
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => void openNotice(item)}
                className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-4 text-left"
              >
                <span className="flex items-center gap-2">
                  {!item.read_at ? (
                    <span className="rounded-full bg-gray-900 px-3 py-1 text-base font-bold text-white">
                      未読
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-base font-bold text-gray-600">
                      既読
                    </span>
                  )}
                </span>
                <span className="mt-2 block text-xl font-bold text-gray-950">
                  {item.title}
                </span>
                {item.body ? (
                  <span className="mt-1 block text-lg text-gray-800">{item.body}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
