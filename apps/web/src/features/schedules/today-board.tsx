"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TodayVisit, TodayWorker } from "@/features/sites/types";
import { normalizePersonName, readPersonName } from "@/lib/person-name";
import { recordScheduleWork } from "@/features/schedules/record-work";
import { Button } from "@/components/ui/button";
import { ActionHint } from "@/components/ui/action-hint";

function isMine(worker: TodayWorker, mine: string, usesDeviceName: boolean, membershipId: string): boolean {
  if (!usesDeviceName && membershipId && worker.membershipId === membershipId) {
    return true;
  }
  return Boolean(mine) && normalizePersonName(worker.name) === mine;
}

/**
 * 「自分の予定」の判定：
 * ・個人アカウント … 作業員名簿に紐づけたアカウント（membership）か、表示名が同じ人
 * ・共通ログイン   … この端末で選んだ名前（サーバーは誰が見ているか分からない）
 */
export function TodayBoard({
  dateLabel,
  prevDate,
  nextDate,
  isToday,
  visits,
  usesDeviceName,
  accountName,
  membershipId,
}: {
  dateLabel: string;
  prevDate: string;
  nextDate: string;
  isToday: boolean;
  visits: TodayVisit[];
  usesDeviceName: boolean;
  accountName: string;
  membershipId: string;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [personName, setPersonName] = useState("");
  const [nameReady, setNameReady] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setPersonName(usesDeviceName ? readPersonName() : accountName);
    setNameReady(true);
  }, [usesDeviceName, accountName]);

  async function record(scheduleId: string, action: "start" | "end") {
    setErrorId(null);
    setLoadingId(scheduleId);
    const result = await recordScheduleWork(scheduleId, action);
    setLoadingId(null);
    if (!result.ok) {
      setErrorId(scheduleId);
      setErrorMessage(result.message);
      return;
    }
    router.refresh();
  }

  const visible = useMemo(() => {
    if (scope === "all") return visits;
    const mine = normalizePersonName(personName);
    return visits.filter((visit) =>
      visit.workers.some((worker) => isMine(worker, mine, usesDeviceName, membershipId)),
    );
  }, [scope, visits, personName, membershipId, usesDeviceName]);

  if (!nameReady) return null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border-2 border-gray-200 bg-white px-4 py-5 text-center">
        <p className="text-lg font-bold text-gray-600">
          {isToday ? "今日" : "選んだ日"}
        </p>
        <p className="mt-1 text-3xl font-bold leading-tight text-gray-950">
          {dateLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/today?date=${prevDate}`}
          className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-gray-300 bg-white text-lg font-bold text-gray-900"
        >
          前日
        </Link>
        <Link
          href={`/today?date=${nextDate}`}
          className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-gray-300 bg-white text-lg font-bold text-gray-900"
        >
          翌日
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setScope("mine")}
          className={`min-h-14 rounded-2xl border-2 text-lg font-bold ${
            scope === "mine"
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-300 bg-white text-gray-900"
          }`}
        >
          自分の予定
        </button>
        <button
          type="button"
          onClick={() => setScope("all")}
          className={`min-h-14 rounded-2xl border-2 text-lg font-bold ${
            scope === "all"
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-300 bg-white text-gray-900"
          }`}
        >
          全員の予定
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white px-4 py-10 text-center">
          <p className="text-2xl font-bold text-gray-900">予定はありません</p>
          <p className="mt-2 text-lg text-gray-600">
            {scope === "mine"
              ? `${personName || "自分"}さんの予定は、この日にはありません。`
              : "この日の予定はまだ登録されていません。"}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((visit) => {
            const mine = normalizePersonName(personName);
            const myWorker = visit.workers.find((worker) =>
              isMine(worker, mine, usesDeviceName, membershipId),
            );
            const showWorkButtons = isToday && !!myWorker;
            return (
            <li
              key={visit.key}
              className="rounded-2xl border-2 border-gray-200 bg-white p-4"
            >
              <p className="text-2xl font-bold text-gray-950">{visit.timeLabel}</p>
              <h2 className="mt-2 text-xl font-bold leading-snug text-gray-950">
                {visit.projectName}
                {visit.customerName ? `／${visit.customerName}` : ""}
              </h2>
              {visit.companyName ? (
                <p className="mt-2 text-lg text-gray-800">会社：{visit.companyName}</p>
              ) : null}
              <p className="mt-2 text-lg text-gray-800">
                場所：{visit.place || "未入力"}
              </p>
              <p className="mt-2 text-lg text-gray-800">
                住所：{visit.address || "未入力"}
              </p>
              <p className="mt-3 text-lg font-bold text-gray-950">今日行う作業</p>
              <p className="whitespace-pre-wrap text-lg text-gray-800">
                {visit.workContent || "作業内容は未入力です"}
              </p>
              <p className="mt-3 text-lg font-bold text-gray-950">担当者</p>
              <p className="text-lg text-gray-800">
                {visit.workers.length > 0
                  ? visit.workers.map((worker) => worker.name).join("、")
                  : "未設定"}
              </p>
              {visit.caution || visit.note ? (
                <>
                  <p className="mt-3 text-lg font-bold text-gray-950">
                    管理者からの注意事項
                  </p>
                  <p className="whitespace-pre-wrap text-lg text-gray-800">
                    {[visit.caution, visit.note].filter(Boolean).join("\n")}
                  </p>
                </>
              ) : null}

              {showWorkButtons && myWorker ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <Button
                      type="button"
                      fullWidth
                      size="lg"
                      loading={loadingId === myWorker.scheduleId}
                      disabled={myWorker.status === "in_progress" || myWorker.status === "completed"}
                      onClick={() => void record(myWorker.scheduleId, "start")}
                    >
                      {myWorker.status === "in_progress" || myWorker.status === "completed"
                        ? "作業中です"
                        : "作業を開始する"}
                    </Button>
                    <ActionHint>押すと、今の時刻で開始を記録します</ActionHint>
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      fullWidth
                      size="lg"
                      loading={loadingId === myWorker.scheduleId}
                      disabled={!myWorker.actualStartTime || myWorker.status === "completed"}
                      onClick={() => void record(myWorker.scheduleId, "end")}
                    >
                      作業を終了する
                    </Button>
                    <ActionHint>押すと、今の時刻で終了を記録します</ActionHint>
                  </div>
                  {errorId === myWorker.scheduleId ? (
                    <p className="rounded-xl bg-red-50 px-4 py-3 text-lg text-red-700">
                      {errorMessage}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <Link
                href={`/sites/${visit.projectId}/progress?work=${encodeURIComponent(visit.workContent || "")}`}
                className="mt-4 flex min-h-14 items-center justify-center rounded-2xl bg-gray-900 px-4 text-lg font-bold text-white"
              >
                作業を確認
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
