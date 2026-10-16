"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ActionHint } from "@/components/ui/action-hint";
import { Input, Textarea } from "@/components/ui/input";
import { todayISO } from "@/lib/site-dates";
import { notifyScheduleChangeAction } from "@/features/schedules/actions";
import { toSaveUserMessage, withTimeout } from "@/lib/client-errors";
import type { ScheduleWithDetails, SiteOption, Worker } from "@/features/sites/types";

// 候補に出す現場名。現場名（会社/依頼元）を正にし、お客様名でも探せるようにする。
function siteLabel(project: SiteOption | undefined): string {
  if (!project) {
    return "";
  }
  return project.name;
}

export function ScheduleForm({
  organizationId,
  workers,
  projects,
  schedule,
  defaultDate,
  onCancel,
  onDelete,
  deleting = false,
}: {
  organizationId: string;
  workers: Worker[];
  projects: SiteOption[];
  schedule?: ScheduleWithDetails;
  defaultDate?: string;
  onCancel?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const initialProjectId = schedule?.project_id ?? "";
  const initialProject = projects.find((p) => p.id === initialProjectId);
  const [projectName, setProjectName] = useState(siteLabel(initialProject));
  const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);
  const projectComboRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    schedule_date: schedule?.schedule_date ?? defaultDate ?? todayISO(),
    project_id: initialProjectId,
    worker_ids: schedule?.worker_id ? [schedule.worker_id] : ([] as string[]),
    client_company_name: schedule?.client_company_name ?? "",
    location: schedule?.location ?? initialProject?.address ?? "",
    work_content: schedule?.work_content ?? "",
    scheduled_start_time: schedule?.scheduled_start_time?.slice(0, 5) ?? "08:30",
    scheduled_end_time: schedule?.scheduled_end_time?.slice(0, 5) ?? "17:00",
    memo: schedule?.memo ?? "",
  });

  function selectProject(projectId: string) {
    const project = projects.find((p) => p.id === projectId);
    setForm((prev) => ({
      ...prev,
      project_id: projectId,
      location: prev.location || project?.address || "",
    }));
  }

  function normalizeProjectName(value: string): string {
    return value.replace(/[\s　]/g, "");
  }

  // 現場名（会社/依頼元）だけでなく、お客様名で入力されても一致させる
  function projectNameCandidates(project: SiteOption): string[] {
    return [project.name, project.customer_name ?? ""].filter(Boolean);
  }

  function handleProjectNameChange(name: string) {
    setProjectName(name);
    setShowProjectSuggestions(true);
    const normalized = normalizeProjectName(name);
    const match = projects.find((p) =>
      projectNameCandidates(p).some(
        (candidate) => normalizeProjectName(candidate) === normalized
      )
    );
    if (match) {
      selectProject(match.id);
    } else {
      setForm((prev) => ({ ...prev, project_id: "" }));
    }
  }

  function chooseProject(project: SiteOption) {
    setProjectName(siteLabel(project));
    selectProject(project.id);
    setShowProjectSuggestions(false);
  }

  const projectSuggestions = projects.filter((p) => {
    const normalized = normalizeProjectName(projectName);
    return projectNameCandidates(p).some((candidate) =>
      normalizeProjectName(candidate).includes(normalized)
    );
  });

  useEffect(() => {
    if (!showProjectSuggestions) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        projectComboRef.current &&
        e.target instanceof Node &&
        !projectComboRef.current.contains(e.target)
      ) {
        setShowProjectSuggestions(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showProjectSuggestions]);

  function toggleWorker(id: string) {
    setForm((prev) => ({
      ...prev,
      worker_ids: prev.worker_ids.includes(id)
        ? prev.worker_ids.filter((workerId) => workerId !== id)
        : [...prev.worker_ids, id],
    }));
  }

  async function tellAssignees(ids: string[], rev: string) {
    try {
      await notifyScheduleChangeAction({
        scheduleIds: ids,
        revision: rev,
        kind: schedule ? "schedule_updated" : "schedule_created",
      });
    } catch {
      // 予定自体は保存済みなので、お知らせの送信失敗は画面に出さない
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.project_id) {
      setError(
        "現場名を一覧から選ぶか、登録済みの現場名・お客様名と同じ文字列を入力してください"
      );
      return;
    }

    setLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const groupId = schedule?.group_id ?? crypto.randomUUID();
      const base = {
        project_id: form.project_id,
        schedule_date: form.schedule_date,
        client_company_name: form.client_company_name.trim() || null,
        location: form.location.trim() || null,
        work_content: form.work_content.trim() || null,
        scheduled_start_time: form.scheduled_start_time || null,
        scheduled_end_time: form.scheduled_end_time || null,
        memo: form.memo.trim() || null,
        time_kind: "timed",
        group_id: groupId,
      };
      const workerIds = form.worker_ids.length > 0 ? form.worker_ids : [null];
      let ids: string[] = [];

      if (schedule) {
        const { error: saveError } = await withTimeout(
          supabase
            .from("schedules")
            .update({ ...base, worker_id: workerIds[0] })
            .eq("id", schedule.id),
          20000,
          "保存がタイムアウトしました。通信状況を確認して、もう一度お試しください。"
        );
        if (saveError) throw saveError;
        ids = [schedule.id];
        const extras = workerIds.slice(1).filter((id): id is string => Boolean(id));
        if (extras.length > 0) {
          const inserted = await supabase
            .from("schedules")
            .insert(
              extras.map((workerId) => ({
                ...base,
                worker_id: workerId,
                organization_id: organizationId,
                status: "scheduled",
              }))
            )
            .select("id");
          if (inserted.error) throw inserted.error;
          ids = ids.concat((inserted.data ?? []).map((row) => row.id));
        }
      } else {
        const inserted = await withTimeout(
          supabase
            .from("schedules")
            .insert(
              workerIds.map((workerId) => ({
                ...base,
                worker_id: workerId,
                organization_id: organizationId,
                status: "scheduled",
              }))
            )
            .select("id"),
          20000,
          "保存がタイムアウトしました。通信状況を確認して、もう一度お試しください。"
        );
        if (inserted.error) throw inserted.error;
        ids = (inserted.data ?? []).map((row) => row.id);
      }

      const rev = new Date().toISOString();
      void tellAssignees(ids, rev);
      if (onCancel) onCancel();
      router.replace(`/kanri/schedules?date=${form.schedule_date}`);
    } catch (err) {
      setError(toSaveUserMessage(err, "予定の保存に失敗しました"));
    } finally {
      setLoading(false);
    }
  }

  if (projects.length === 0) {
    return (
      <p className="text-lg text-gray-600">
        予定を登録するには、先に現場を登録してください。
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label="作業する日"
        type="date"
        value={form.schedule_date}
        onChange={(e) => setForm({ ...form, schedule_date: e.target.value })}
        required
      />
      <div className="relative" ref={projectComboRef}>
        <Input
          label="現場名"
          value={projectName}
          onChange={(e) => handleProjectNameChange(e.target.value)}
          onFocus={() => setShowProjectSuggestions(true)}
          placeholder="登録した現場から選んでください"
          autoComplete="off"
        />
        {showProjectSuggestions && projectSuggestions.length > 0 ? (
          <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border-2 border-gray-300 bg-white shadow-lg">
            {projectSuggestions.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => chooseProject(p)}
                  className="flex min-h-14 w-full flex-col items-start justify-center px-4 text-left active:bg-gray-100"
                >
                  <span className="text-lg font-bold text-gray-950">{siteLabel(p)}</span>
                  {p.customer_name ? (
                    <span className="text-sm text-gray-500">
                      お客様名：{p.customer_name}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Input
        label="会社／依頼元"
        value={form.client_company_name}
        onChange={(e) => setForm({ ...form, client_company_name: e.target.value })}
      />
      <Input
        label="場所"
        value={form.location}
        onChange={(e) => setForm({ ...form, location: e.target.value })}
      />
      <Textarea
        label="今日の作業内容"
        value={form.work_content}
        onChange={(e) => setForm({ ...form, work_content: e.target.value })}
        rows={3}
        placeholder="例：1階キッチンの給水"
        required
      />
      <fieldset>
        <legend className="mb-2 text-lg font-bold text-gray-900">担当者</legend>
        <div className="space-y-2">
          {workers.filter((worker) => worker.status !== "inactive").map((worker) => (
            <label key={worker.id} className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-gray-200 px-3 text-lg font-bold">
              <input
                type="checkbox"
                className="h-6 w-6"
                checked={form.worker_ids.includes(worker.id)}
                onChange={() => toggleWorker(worker.id)}
              />
              {worker.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="開始時刻"
          type="time"
          value={form.scheduled_start_time}
          onChange={(e) =>
            setForm({ ...form, scheduled_start_time: e.target.value })
          }
        />
        <Input
          label="終了時刻"
          type="time"
          value={form.scheduled_end_time}
          onChange={(e) =>
            setForm({ ...form, scheduled_end_time: e.target.value })
          }
        />
      </div>
      <Textarea
        label="注意事項"
        value={form.memo}
        onChange={(e) => setForm({ ...form, memo: e.target.value })}
        rows={2}
      />
      {error ? (
        <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
          {error}
        </p>
      ) : null}
      <div className={onCancel ? "grid grid-cols-2 gap-3" : ""}>
        {onCancel ? (
          <Button type="button" variant="secondary" fullWidth onClick={onCancel}>
            やめる
          </Button>
        ) : null}
        <Button type="submit" fullWidth loading={loading}>
          {loading
            ? "保存しています"
            : schedule
              ? "変更を保存する"
              : "この予定を登録する"}
        </Button>
      </div>
      {!schedule ? (
        <ActionHint>日付・現場・作業員を選んで登録します</ActionHint>
      ) : null}
      {schedule && onDelete ? (
        <Button
          type="button"
          variant="danger"
          fullWidth
          loading={deleting}
          onClick={onDelete}
        >
          この予定を削除する
        </Button>
      ) : null}
    </form>
  );
}
