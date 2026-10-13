"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { readPersonName, savePersonName } from "@/lib/person-name";

/**
 * 共通の合言葉でログインした端末だけで使う。最初の1回だけ名前を聞き、端末に覚える。
 * 「自分の予定」はこの名前と予定の作業員名を画面側で照らし合わせるだけ（セキュリティの境界ではない）。
 */
export function PersonNameGate({ children, organizationId }: { children: ReactNode; organizationId: string }) {
  const [gate, setGate] = useState({ ready: false, saved: false });
  const [workerNames, setWorkerNames] = useState<string[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [useOther, setUseOther] = useState(false);
  const [name, setName] = useState("");
  const { ready, saved } = gate;

  useEffect(() => {
    const existing = readPersonName();
    setGate({ ready: true, saved: existing.length > 0 });
  }, []);

  useEffect(() => {
    if (saved) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error } = await supabase
          .from("workers")
          .select("name")
          .eq("organization_id", organizationId)
          .eq("status", "active")
          .order("name", { ascending: true });
        if (!cancelled && !error && data) {
          setWorkerNames(
            (data as { name: string | null }[])
              .map((w) => w.name)
              .filter((n): n is string => Boolean(n?.trim())),
          );
        }
      } finally {
        if (!cancelled) setLoadingWorkers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [saved, organizationId]);

  if (!ready) return null;

  if (!saved) {
    const choose = (selected: string) => {
      const trimmed = selected.trim();
      if (!trimmed) {
        return;
      }
      savePersonName(trimmed);
      setGate((prev) => ({ ...prev, saved: true }));
    };

    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
        <h1 className="text-3xl font-bold text-gray-950">お名前を入れてください</h1>
        <p className="mt-3 text-lg text-gray-700">
          最初の1回だけです。次からはこの端末で、その人の予定を出します。登録されている作業員名簿から選んでください。
        </p>

        {!useOther ? (
          <div className="mt-8 space-y-4">
            {loadingWorkers ? (
              <p className="text-lg text-gray-600">読み込み中…</p>
            ) : workerNames.length > 0 ? (
              <ul className="space-y-3">
                {workerNames.map((workerName) => (
                  <li key={workerName}>
                    <button
                      type="button"
                      onClick={() => choose(workerName)}
                      className="flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-gray-300 bg-white px-4 text-xl font-bold text-gray-950"
                    >
                      {workerName}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-lg text-gray-600">
                作業員名簿がまだありません。下から名前を入力してください。
              </p>
            )}
            <button
              type="button"
              onClick={() => setUseOther(true)}
              className="flex min-h-12 w-full items-center justify-center text-base font-bold text-gray-600 underline"
            >
              リストにない名前で使う
            </button>
          </div>
        ) : (
          <form
            className="mt-8 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              choose(name);
            }}
          >
            <label className="block text-lg font-bold text-gray-900" htmlFor="person-name">
              名前
            </label>
            <input
              id="person-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              className="min-h-14 w-full rounded-2xl border-2 border-gray-300 px-4 text-xl"
            />
            <p className="text-base text-gray-500">
              登録されている作業員名簿と同じ名前で入力すると、自分の予定が正しく表示されます。
            </p>
            <button
              type="submit"
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-gray-900 text-lg font-bold text-white"
            >
              この名前で使う
            </button>
            {workerNames.length > 0 ? (
              <button
                type="button"
                onClick={() => setUseOther(false)}
                className="flex min-h-12 w-full items-center justify-center text-base font-bold text-gray-600 underline"
              >
                名簿から選ぶ
              </button>
            ) : null}
          </form>
        )}
      </main>
    );
  }

  return <>{children}</>;
}
