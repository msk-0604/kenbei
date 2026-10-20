"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { scheduleStatusLabel } from "@/lib/site-rules";
import { recordScheduleWork } from "@/features/schedules/record-work";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionHint } from "@/components/ui/action-hint";
import { formatClockTime, formatTime, todayISO } from "@/lib/site-dates";
import type { ScheduleWithDetails } from "@/features/sites/types";

export function ScheduleCard({
  schedule,
  onEdit,
  onCopy,
  onDelete,
  deleting,
  hideProjectName = false,
  canManage = true,
}: {
  schedule: ScheduleWithDetails;
  onEdit: () => void;
  /** 同じ内容の予定をほかの日にも入れる */
  onCopy?: () => void;
  onDelete: () => void;
  deleting?: boolean;
  hideProjectName?: boolean;
  canManage?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"start" | "end" | null>(null);
  const [error, setError] = useState("");
  const isToday = schedule.schedule_date === todayISO();
  const displayTitle =
    schedule.title || schedule.project_name || "現場作業";

  const timeRange =
    schedule.scheduled_start_time || schedule.scheduled_end_time
      ? `${formatTime(schedule.scheduled_start_time) || "—"}〜${formatTime(schedule.scheduled_end_time) || "—"}`
      : null;

  async function record(action: "start" | "end") {
    setLoading(action);
    const result = await recordScheduleWork(schedule.id, action);
    setLoading(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    router.refresh();
  }

  const statusLabel = scheduleStatusLabel(schedule.status);

  return (
    <Card className="!p-5">
      {schedule.worker_name ? (
        <div className="mb-4 rounded-2xl border-2 border-navy-200 bg-navy-900/5 px-4 py-3">
          <p className="text-base font-bold text-navy-700">作業員</p>
          <p className="mt-1 text-2xl font-bold text-navy-950">
            {schedule.worker_name}
          </p>
        </div>
      ) : (
        <div className="mb-4 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3">
          <p className="text-lg font-bold text-gray-500">作業員は未割当</p>
        </div>
      )}

      {timeRange ? (
        <p className="text-base font-bold text-navy-700">{timeRange}</p>
      ) : null}
      <p className="mt-1 text-xl font-bold text-navy-950">{displayTitle}</p>

      {schedule.client_company_name ? (
        <p className="mt-2 text-base text-gray-600">
          会社：{schedule.client_company_name}
        </p>
      ) : null}
      {schedule.location ? (
        <p className="mt-1 text-base text-gray-600">
          場所：{schedule.location}
        </p>
      ) : null}
      {!hideProjectName && schedule.project_name ? (
        <p className="mt-1 text-base text-gray-600">
          現場：{schedule.project_name}
        </p>
      ) : null}

      {schedule.work_content ? (
        <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3">
          <p className="text-base font-bold text-gray-600">作業内容</p>
          <p className="mt-1 text-xl text-navy-950">{schedule.work_content}</p>
        </div>
      ) : null}

      {schedule.actual_start_time || schedule.actual_end_time ? (
        <p className="mt-2 text-base font-bold text-green-800">
          実績：
          {schedule.actual_start_time
            ? formatClockTime(schedule.actual_start_time)
            : "—"}
          〜
          {schedule.actual_end_time
            ? formatClockTime(schedule.actual_end_time)
            : "—"}
        </p>
      ) : null}

      <p className="mt-2 text-lg font-bold text-gray-700">状態：{statusLabel}</p>

      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-lg text-red-700">
          {error}
        </p>
      ) : null}

      {isToday && schedule.status !== "completed" ? (
        <div className="mt-5 space-y-3">
          <div>
            <Button
              type="button"
              fullWidth
              size="lg"
              loading={loading === "start"}
              disabled={schedule.status === "in_progress"}
              onClick={() => void record("start")}
            >
              作業を開始する
            </Button>
            <ActionHint>押すと、関係者に通知が届きます</ActionHint>
          </div>
          <div>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              size="lg"
              loading={loading === "end"}
              disabled={
                !schedule.actual_start_time && schedule.status !== "in_progress"
              }
              onClick={() => void record("end")}
            >
              作業を終了する
            </Button>
            <ActionHint>作業が終わったことを記録します</ActionHint>
          </div>
        </div>
      ) : null}

      {canManage ? (
        <div className="mt-4 space-y-3">
          <Button type="button" variant="secondary" size="md" fullWidth onClick={onEdit}>
            内容を変更する
          </Button>
          {onCopy ? (
            <Button type="button" variant="secondary" size="md" fullWidth onClick={onCopy}>
              ほかの日にもコピーする
            </Button>
          ) : null}
          <Button
            type="button"
            variant="danger"
            size="md"
            fullWidth
            loading={deleting}
            onClick={onDelete}
          >
            この予定を削除する
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
