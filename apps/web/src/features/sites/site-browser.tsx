"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { OneOffBadge, StatusBadge } from "@/components/ui/badge";
import type { SiteStatus, WorkDuration } from "@/lib/site-rules";

type SiteCard = {
  id: string;
  name: string;
  address: string | null;
  primeContractorName: string | null;
  customerName: string | null;
  status: SiteStatus;
  workDuration?: WorkDuration | null;
  today: boolean;
};

type StatusFilter = "in_progress" | "one_off" | "completed" | "tentative";
type LinkTo = "detail" | "progress";

export function SiteBrowser({
  sites,
  linkTo = "detail",
}: {
  sites: SiteCard[];
  linkTo?: LinkTo;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("in_progress");
  const filtered = useMemo(() => {
    const q = query.trim();
    return sites.filter((site) => {
      const matchesFilter =
        filter === "one_off"
          ? site.workDuration === "one_off"
          : filter === "completed"
            ? site.status === "completed" || site.status === "cancelled"
            : filter === "tentative"
              ? site.status === "draft"
              : site.status === "active" || site.status === "on_hold";
      if (!matchesFilter) return false;
      if (!q) return true;
      return [site.name, site.customerName, site.address]
        .filter(Boolean)
        .some((value) => value?.includes(q));
    });
  }, [sites, query, filter]);

  const todaySites = filtered.filter((site) => site.today);
  const others = filtered.filter((site) => !site.today);

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="現場名・お客様名・住所"
        className="min-h-14 w-full rounded-2xl border-2 border-gray-300 px-4 text-lg"
      />
      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => setFilter("in_progress")}
          className={`min-h-14 rounded-2xl border-2 text-base font-bold ${filter === "in_progress" ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white"}`}
        >
          進行中
        </button>
        <button
          type="button"
          onClick={() => setFilter("one_off")}
          className={`min-h-14 rounded-2xl border-2 text-base font-bold ${filter === "one_off" ? "border-navy-900 bg-navy-900 text-white" : "border-gray-300 bg-white"}`}
        >
          単発
        </button>
        <button
          type="button"
          onClick={() => setFilter("completed")}
          className={`min-h-14 rounded-2xl border-2 text-base font-bold ${filter === "completed" ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white"}`}
        >
          完了済み
        </button>
        <button
          type="button"
          onClick={() => setFilter("tentative")}
          className={`min-h-14 rounded-2xl border-2 text-base font-bold ${filter === "tentative" ? "border-orange-500 bg-orange-500 text-white" : "border-gray-300 bg-white"}`}
        >
          仮予定
        </button>
      </div>
      {todaySites.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xl font-bold">今日の担当現場</h2>
          <SiteCards sites={todaySites} linkTo={linkTo} />
        </section>
      ) : null}
      <SiteCards sites={others} linkTo={linkTo} />
      {filtered.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-gray-300 px-4 py-8 text-center text-xl font-bold">
          該当する現場はありません
        </p>
      ) : null}
    </div>
  );
}

function SiteCards({ sites, linkTo }: { sites: SiteCard[]; linkTo: LinkTo }) {
  return (
    <ul className="space-y-4">
      {sites.map((site) => (
        <li key={site.id} className="cv-auto">
          <Link
            href={
              linkTo === "progress"
                ? `/sites/${site.id}/progress`
                : `/sites/${site.id}`
            }
            className="block"
          >
            <Card>
              {/* スマホでは状態のバッジを上に出し、現場名と住所は横幅いっぱいに使う */}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <h3 className="text-2xl font-bold text-gray-950">{site.name}</h3>
                  {site.primeContractorName ? (
                    <p className="mt-1 text-lg text-gray-800">
                      <span className="text-gray-500">元請け先：</span>
                      {site.primeContractorName}
                    </p>
                  ) : null}
                  <p className="mt-1 text-lg text-gray-800">
                    <span className="text-gray-500">お客様名：</span>
                    {site.customerName || "未入力です"}
                  </p>
                  <p className="mt-1 text-lg text-gray-700">
                    <span className="text-gray-500">住所：</span>
                    {site.address || "未入力です"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 self-start">
                  {site.workDuration === "one_off" ? <OneOffBadge /> : null}
                  <StatusBadge status={site.status} />
                </div>
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
