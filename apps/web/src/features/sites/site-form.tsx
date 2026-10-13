"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Site } from "@/features/sites/types";
import { deleteSiteAction, saveSiteAction } from "@/features/sites/actions";
import {
  SITE_FORM_STATUSES,
  SITE_STATUS_LABELS,
  type SiteStatus,
  type WorkDuration,
} from "@/lib/site-rules";
import { Button } from "@/components/ui/button";
import { ComboInput, Input, Select, Textarea } from "@/components/ui/input";

const WORK_TYPE_OPTIONS = ["新築", "改修", "修理"] as const;

type Props = {
  project?: Site;
  /** 保存後の移動先（未指定なら現場詳細へ） */
  successHref?: string;
  /** 指定時は新規登録後に遷移せず、作成結果を渡す（同一画面で工程作成用） */
  onCreated?: (site: { id: string; name: string }) => void;
};

const defaultForm = {
  name: "",
  address: "",
  manager_name: "",
  prime_contractor_name: "",
  customer_name: "",
  work_type: "",
  caution: "",
  start_date: "",
  end_date: "",
  status: "active" as SiteStatus,
  memo: "",
  work_duration: "long_term" as WorkDuration,
};

export function SiteForm({
  project,
  successHref,
  onCreated,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState(
    project
      ? {
          name: project.name,
          address: project.address ?? "",
          manager_name: project.manager_name ?? "",
          prime_contractor_name: project.prime_contractor_name ?? "",
          customer_name: project.customer_name ?? "",
          work_type: project.work_type ?? "",
          caution: project.caution ?? "",
          start_date: project.start_date ?? "",
          end_date: project.end_date ?? "",
          status: project.status,
          memo: project.memo ?? "",
          work_duration: project.work_duration ?? "long_term",
        }
      : defaultForm
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // 一時停止・中止の現場は、その状態も選べるように残す
  const statusOptions: SiteStatus[] =
    project && !(SITE_FORM_STATUSES as readonly string[]).includes(project.status)
      ? [...SITE_FORM_STATUSES, project.status]
      : [...SITE_FORM_STATUSES];
  const [deleting, setDeleting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleDelete() {
    if (!project) return;
    if (
      !window.confirm(
        `「${project.name}」を削除します。予定と作業工程も消え、元に戻せません（写真と日報の記録は残ります）。本当に削除しますか？`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError("");
    const result = await deleteSiteAction(project.id).catch(() => ({
      ok: false as const,
      error: "削除に失敗しました。もう一度お試しください。",
    }));
    if (!result.ok) {
      setError(result.error);
      setDeleting(false);
      return;
    }
    router.replace("/sites");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const name = form.name.trim();
    if (!name) {
      setError("現場名（会社/依頼元）を入力してください");
      return;
    }

    if (
      form.start_date &&
      form.end_date &&
      form.start_date > form.end_date
    ) {
      setError("完了予定日は着工日と同じか、それより後にしてください");
      return;
    }

    setLoading(true);
    const notify =
      (e.nativeEvent as SubmitEvent).submitter?.getAttribute("data-notify") ===
      "1";

    try {
      const payload = {
        name,
        address: form.address,
        manager_name: form.manager_name,
        prime_contractor_name: form.prime_contractor_name,
        customer_name: form.customer_name,
        work_type: form.work_type,
        caution: form.caution,
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
        memo: form.memo,
        work_duration: form.work_duration,
      };
      const data = await saveSiteAction(project ? { id: project.id, notify, ...payload } : { notify, ...payload });
      if (!data.ok) {
        throw new Error(data.error);
      }

      if (data.noticeError) {
        router.replace(`/sites/${data.id}?notice=retry`);
        router.refresh();
        return;
      }

      if (!project && onCreated) {
        onCreated({ id: data.id, name: data.name ?? name });
        return;
      }

      router.replace(successHref ?? `/sites/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error && /[ぁ-んァ-ン一-龥]/.test(err.message) ? err.message : "保存に失敗しました。通信を確認して、もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section>
        <label className="block text-lg font-bold text-gray-800">
          長期／単発
        </label>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => update("work_duration", "long_term")}
            className={`tap-press min-h-14 rounded-2xl border-2 text-lg font-bold ${
              form.work_duration === "long_term"
                ? "border-navy-900 bg-navy-900 text-white"
                : "border-gray-300 bg-white text-gray-900"
            }`}
          >
            長期
          </button>
          <button
            type="button"
            onClick={() => update("work_duration", "one_off")}
            className={`tap-press min-h-14 rounded-2xl border-2 text-lg font-bold ${
              form.work_duration === "one_off"
                ? "border-navy-900 bg-navy-900 text-white"
                : "border-gray-300 bg-white text-gray-900"
            }`}
          >
            単発
          </button>
        </div>
        <p className="mt-2 text-base text-gray-500">
          単発は、1日で終わる工事に選んでください。現場一覧などで分かるように表示されます。
        </p>
      </section>
      <Input
        label="現場名・会社/依頼元（必須）"
        value={form.name}
        onChange={(e) => update("name", e.target.value)}
        maxLength={200}
        required
      />
      <Input
        label="お客様名"
        value={form.customer_name}
        onChange={(e) => update("customer_name", e.target.value)}
      />
      <Input
        label="住所"
        value={form.address}
        onChange={(e) => update("address", e.target.value)}
      />
      <ComboInput
        label="工事内容"
        value={form.work_type}
        onChange={(value) => update("work_type", value)}
        options={WORK_TYPE_OPTIONS}
        placeholder="候補から選ぶか、自由に入力してください"
        maxLength={50}
      />
      <Input
        label="担当者名"
        value={form.manager_name}
        onChange={(e) => update("manager_name", e.target.value)}
      />
      <Input
        label="着工日"
        type="date"
        value={form.start_date}
        onChange={(e) => update("start_date", e.target.value)}
      />
      <Input
        label="完了予定日"
        type="date"
        value={form.end_date}
        onChange={(e) => update("end_date", e.target.value)}
      />
      <Select
        label="工事の状態"
        value={form.status}
        onChange={(e) => update("status", e.target.value as SiteStatus)}
      >
        {statusOptions.map((s) => (
          <option key={s} value={s}>
            {SITE_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      <Textarea
        label="注意事項"
        value={form.caution}
        onChange={(e) => update("caution", e.target.value)}
        rows={3}
      />
      <Textarea
        label="メモ（任意）"
        value={form.memo}
        onChange={(e) => update("memo", e.target.value)}
        rows={4}
      />
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-lg text-red-700">
          {error}
        </p>
      ) : null}
      {project ? (
        <Button type="submit" fullWidth loading={loading}>
          変更を保存する
        </Button>
      ) : (
        <Button type="submit" data-notify="1" fullWidth loading={loading}>
          登録して全員に知らせる
        </Button>
      )}
      {project ? (
        <Button
          type="button"
          variant="danger"
          fullWidth
          loading={deleting}
          onClick={() => void handleDelete()}
        >
          この現場を削除する
        </Button>
      ) : null}
    </form>
  );
}
