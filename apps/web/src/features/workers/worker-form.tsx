"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { toSaveUserMessage, withTimeout } from "@/lib/client-errors";
import { notifyCompanyEvent } from "@/lib/push/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Worker } from "@/features/sites/types";
import { Select } from "@/components/ui/input";

function buildInviteMessage(workerName: string, loginCode: string | null, hasAccount: boolean): string | null {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (hasAccount) {
    return `【KENBEI】${workerName}さんへ\n\n下のURLを開いて、いつものメールアドレスとパスワードでログインしてください。\n\n${origin}/login`;
  }
  if (!loginCode) {
    return null;
  }
  return `【KENBEI】${workerName}さんへ\n\n下のURLを開いて、会社の合言葉でログインしてください。\n合言葉が分からない場合は、担当者にお尋ねください。\n\n${origin}/login?company=${loginCode}`;
}

function InviteMessageCard({
  workerName,
  loginCode,
  hasAccount,
  onRegisterAnother,
}: {
  workerName: string;
  loginCode: string | null;
  hasAccount: boolean;
  onRegisterAnother: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const message = buildInviteMessage(workerName, loginCode, hasAccount);

  async function handleCopy() {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="space-y-6">
      <p className="rounded-2xl border-2 border-green-200 bg-green-50 px-4 py-3 text-lg font-bold text-green-800">
        {workerName}さんを登録しました
      </p>
      {message ? (
        <>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-gray-800">
              LINEなどで送るメッセージ
            </h2>
            <p className="text-base text-gray-600">
              下のメッセージをコピーして、{workerName}さんにLINEなどで送ってください。
            </p>
            <pre className="whitespace-pre-wrap rounded-2xl border-2 border-gray-300 bg-white px-5 py-5 text-lg text-gray-900">
              {message}
            </pre>
          </section>
          <Button type="button" fullWidth size="lg" onClick={() => void handleCopy()}>
            {copied ? "コピーしました" : "メッセージをコピーする"}
          </Button>
        </>
      ) : (
        <section className="space-y-3 rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4">
          <h2 className="text-lg font-bold text-amber-900">
            {workerName}さんがスマホで見るには、ログインの準備が要ります
          </h2>
          <p className="text-base text-amber-900">
            会社の合言葉を決めるか、{workerName}さんをメールで招待してください。予定はこのまま登録できます。
          </p>
          <div className="flex flex-col gap-2">
            <Button type="button" fullWidth size="lg" onClick={() => router.push("/settings#passcode")}>
              作業員の合言葉を決める
            </Button>
            <Button type="button" variant="secondary" fullWidth size="lg" onClick={() => router.push("/settings/members")}>
              メールで招待する
            </Button>
          </div>
        </section>
      )}
      <Button
        type="button"
        variant="secondary"
        fullWidth
        size="lg"
        onClick={onRegisterAnother}
      >
        続けて別の作業員を登録する
      </Button>
      <Button
        type="button"
        variant="secondary"
        fullWidth
        size="lg"
        onClick={() => router.push("/kanri")}
      >
        管理画面に戻る
      </Button>
    </div>
  );
}

export type MemberOption = { membershipId: string; displayName: string };

export function WorkerForm({
  worker,
  organizationId,
  loginCode,
  members,
}: {
  worker?: Worker;
  organizationId: string;
  /** 合言葉ログインの会社コード（招待メッセージのURLに入れる） */
  loginCode: string | null;
  /** 個人アカウントを持つメンバー。紐づけると「自分の予定」がアカウントで分かる */
  members: MemberOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: worker?.name ?? "",
    phone: worker?.phone ?? "",
    membership_id: worker?.membership_id ?? "",
    status: worker?.status ?? "active",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createBrowserSupabaseClient();
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      membership_id: form.membership_id || null,
      status: form.status,
    };

    try {
      if (worker) {
        const { error: updateError } = await withTimeout(
          supabase
            .from("workers")
            .update(payload)
            .eq("id", worker.id)
            .eq("organization_id", organizationId),
          20000,
          "保存がタイムアウトしました。通信状況を確認して、もう一度お試しください。"
        );
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await withTimeout(
          supabase.from("workers").insert({
            ...payload,
            organization_id: organizationId,
          }),
          20000,
          "保存がタイムアウトしました。通信状況を確認して、もう一度お試しください。"
        );
        if (insertError) throw insertError;
      }
      void notifyCompanyEvent({
        event: worker ? "worker_updated" : "worker_created",
      });
      if (worker) {
        router.replace("/workers");
        router.refresh();
      } else {
        setCreatedName(payload.name);
      }
    } catch (err) {
      setError(toSaveUserMessage(err, "作業員の保存に失敗しました"));
    } finally {
      setLoading(false);
    }
  }

  if (createdName) {
    return (
      <InviteMessageCard
        workerName={createdName}
        loginCode={loginCode}
        hasAccount={Boolean(form.membership_id)}
        onRegisterAnother={() => {
          setCreatedName(null);
          setForm({ name: "", phone: "", membership_id: "", status: "active" });
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label="作業員の名前（必須）"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <Input
        label="電話番号（任意）"
        type="tel"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        placeholder="090-1234-5678"
      />
      {members.length > 0 ? (
        <Select
          label="アカウントと紐づける（任意）"
          value={form.membership_id}
          onChange={(e) => setForm({ ...form, membership_id: e.target.value })}
        >
          <option value="">紐づけない（合言葉でログインする人）</option>
          {members.map((member) => (
            <option key={member.membershipId} value={member.membershipId}>
              {member.displayName}
            </option>
          ))}
        </Select>
      ) : null}
      {worker ? (
        <Select
          label="状態"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as Worker["status"] })}
        >
          <option value="active">稼働中（予定に入れられる）</option>
          <option value="inactive">休止中（予定の候補に出さない）</option>
        </Select>
      ) : null}
      {error ? (
        <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
          {error}
        </p>
      ) : null}
      <Button type="submit" fullWidth loading={loading}>
        {loading ? "保存しています" : worker ? "変更を保存する" : "作業員を登録する"}
      </Button>
    </form>
  );
}
