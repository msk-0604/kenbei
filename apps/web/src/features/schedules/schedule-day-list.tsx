"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ScheduleForm } from "@/features/schedules/schedule-form";
import { ScheduleCard } from "@/features/schedules/schedule-card";
import { WorkerNameList } from "@/components/ui/worker-name-list";
import { notifyCompanyEvent } from "@/lib/push/client";
import { groupSchedulesByProject } from "@/features/schedules/group";
import { addDaysISO, todayISO } from "@/lib/site-dates";
import type { ScheduleWithDetails, SiteOption, Worker } from "@/features/sites/types";

export function ScheduleDayList({
  schedules,
  organizationId,
  workers,
  projects,
  selectedDate,
  canManage = true,
}: {
  schedules: ScheduleWithDetails[];
  organizationId: string;
  workers: Worker[];
  projects: SiteOption[];
  selectedDate: string;
  canManage?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ScheduleWithDetails | null>(null);
  const [copying, setCopying] = useState<(ScheduleWithDetails & { workerIds: string[] }) | null>(null);

  function startCopy(s: ScheduleWithDetails) {
    // 同じグループ（一緒に登録した作業員）は全員そのままコピーする
    const sameGroup = s.group_id ? schedules.filter((other) => other.group_id === s.group_id) : [s];
    const workerIds = [...new Set(sameGroup.map((other) => other.worker_id).filter((id): id is string => Boolean(id)))];
    setEditing(null);
    setCopying({ ...s, workerIds });
  }
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const grouped = groupSchedulesByProject(schedules);

  async function handleDelete(id: string) {
    if (!window.confirm("この予定を削除しますか？")) return;
    setDeletingId(id);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from("schedules")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    setDeletingId(null);
    if (error) {
      window.alert("削除できませんでした。通信を確認して、もう一度お試しください。");
      return;
    }
    const deleted = schedules.find((s) => s.id === id);
    void notifyCompanyEvent({
      event: "schedule_cancelled",
      siteId: deleted?.project_id,
      scheduleId: id,
    });
    if (editing?.id === id) setEditing(null);
    router.refresh();
  }

  if (copying) {
    return (
      <section className="mb-8">
        <h2 className="mb-2 text-lg font-bold text-gray-800">ほかの日にもコピーする</h2>
        <p className="mb-4 text-base text-gray-600">日付を選んで登録してください。ほかの内容も、ここで変えられます。</p>
        <ScheduleForm
          organizationId={organizationId}
          workers={workers}
          projects={projects}
          template={copying}
          defaultDate={addDaysISO(copying.schedule_date, 1)}
          onCancel={() => setCopying(null)}
        />
      </section>
    );
  }

  if (editing) {
    return (
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-bold text-gray-800">予定を変更する</h2>
        <ScheduleForm
          organizationId={organizationId}
          workers={workers}
          projects={projects}
          schedule={editing}
          onCancel={() => setEditing(null)}
          onDelete={() => void handleDelete(editing.id)}
          deleting={deletingId === editing.id}
        />
      </section>
    );
  }

  return (
    <section className="mb-8">
      {grouped.length > 0 ? (
        <div className="mb-8 space-y-8">
          {grouped.map((group) => (
            <section key={group.projectId}>
              <div className="mb-4 rounded-2xl border-2 border-navy-900 bg-navy-900 px-5 py-4 text-white">
                <p className="text-base font-bold text-white/80">現場</p>
                <h2 className="mt-1 text-2xl font-bold leading-snug">
                  {group.projectName}
                </h2>
                <div className="mt-3">
                  <p className="mb-2 text-base font-bold text-white/80">
                    {selectedDate === todayISO() ? "今日" : "この日"}の作業員（{group.workerNames.length}人）
                  </p>
                  {group.workerNames.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {group.workerNames.map((name) => (
                        <li
                          key={name}
                          className="rounded-xl bg-white px-3 py-2 text-lg font-bold text-navy-950"
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-base font-bold text-white/70">
                      作業員は未割当です
                    </p>
                  )}
                </div>
                <Link
                  href={`/sites/${group.projectId}`}
                  className="mt-4 inline-block text-base font-bold text-white underline"
                >
                  この現場の詳細を見る →
                </Link>
              </div>

              <ul className="space-y-4">
                {group.items.map((s) => (
                  <li key={s.id} className="cv-auto">
                    <ScheduleCard
                      schedule={s}
                      hideProjectName
                      canManage={canManage}
                      onEdit={() => setEditing(s)}
                      onCopy={() => startCopy(s)}
                      onDelete={() => handleDelete(s.id)}
                      deleting={deletingId === s.id}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {canManage && schedules.length === 0 && workers.length === 0 ? (
        <div className="mb-6 rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-lg font-bold text-amber-950">
            作業員がまだ登録されていません
          </p>
          <p className="mt-2 text-base text-amber-900">
            予定に名前を付けるには、先に作業員を登録してください。
          </p>
          <Link
            href="/workers/new"
            className="mt-3 inline-block text-lg font-bold text-navy-900 underline"
          >
            作業員を登録する →
          </Link>
        </div>
      ) : null}

      {canManage ? (
        <section>
          <h2 className="mb-4 text-lg font-bold text-gray-800">
            新しい予定を追加する
          </h2>
          {workers.length > 0 ? (
            <div className="mb-4 rounded-2xl border-2 border-gray-200 bg-white px-4 py-3">
              <p className="mb-2 text-base font-bold text-gray-700">
                登録済みの作業員
              </p>
              <WorkerNameList names={workers.map((w) => w.name)} />
            </div>
          ) : null}
          <ScheduleForm
            organizationId={organizationId}
            workers={workers}
            projects={projects}
            defaultDate={selectedDate}
          />
        </section>
      ) : null}
    </section>
  );
}
