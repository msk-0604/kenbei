"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OneOffBadge, StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/site-dates";
import { loadDaySitesAction } from "@/features/schedules/actions";
import type { DaySite } from "@/features/sites/types";

export function DaySitesPanel({
  date,
  onClose,
}: {
  date: string;
  onClose: () => void;
}) {
  const [sites, setSites] = useState<DaySite[] | null>(null);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);

  function requestClose() {
    setClosing(true);
    window.setTimeout(onClose, 200);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setClosing(true);
        window.setTimeout(onClose, 200);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void loadDaySitesAction(date)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if ("error" in result) {
          setError(result.error);
          setSites([]);
          return;
        }
        setSites(result.sites);
      })
      .catch(() => {
        if (!cancelled) {
          setError("読み込みに失敗しました。もう一度お試しください。");
          setSites([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4",
        closing ? "modal-backdrop-leave" : "modal-backdrop-enter"
      )}
      onClick={requestClose}
    >
      <div
        className={cn(
          "max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#eef1f7] p-5 shadow-xl",
          closing ? "modal-panel-leave" : "modal-panel-enter"
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${formatDate(date)}の現場`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-navy-950">
            {formatDate(date)}の現場
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="閉じる"
            className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 text-2xl font-bold leading-none text-gray-700"
          >
            ×
          </button>
        </div>

        {sites === null ? (
          <p className="text-lg text-gray-600">読み込んでいます…</p>
        ) : error ? (
          <p className="text-lg text-red-700">{error}</p>
        ) : sites.length === 0 ? (
          <p className="text-lg text-gray-600">この日の予定はありません</p>
        ) : (
          <ul className="space-y-3">
            {sites.map((site) => (
              <li key={site.id}>
                <Link
                  href={`/sites/${site.id}`}
                  onClick={onClose}
                  className="tap-press block rounded-2xl border-2 border-gray-200 bg-white p-4 active:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xl font-bold text-gray-950">
                      {site.name}
                    </h3>
                    <div className="flex shrink-0 items-center gap-2">
                      {site.workDuration === "one_off" ? <OneOffBadge /> : null}
                      <StatusBadge status={site.status} />
                    </div>
                  </div>
                  {site.customerName ? (
                    <p className="mt-2 text-base text-gray-700">
                      <span className="text-gray-500">お客様名：</span>
                      {site.customerName}
                    </p>
                  ) : null}
                  {site.address ? (
                    <p className="mt-1 text-base text-gray-700">
                      <span className="text-gray-500">住所：</span>
                      {site.address}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link
          href={`/schedule?date=${date}&open=1`}
          onClick={onClose}
          className="tap-press mt-4 flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-navy-900 bg-white text-lg font-bold text-navy-900"
        >
          この日の予定を見る・変更する
        </Link>
      </div>
    </div>
  );
}
