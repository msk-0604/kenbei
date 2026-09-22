"use client";

import { useActionState, useState } from "react";
import { createInviteAction, setMembershipStatusAction, updateCompanySettingsAction } from "@/features/settings/actions";
import { ActionNotice, FormSuccessNotice } from "@/components/action-notice";
import { toUserActionError } from "@/lib/user-error";

export function CompanySettingsForm({
  companyDisplayName,
  organizationName,
  logoUrl,
}: {
  companyDisplayName: string | null;
  organizationName: string;
  logoUrl: string | null;
}) {
  const [state, action, pending] = useActionState(updateCompanySettingsAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm font-medium">
        会社の表示名
        <input
          name="companyDisplayName"
          defaultValue={companyDisplayName || organizationName}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-4"
        />
      </label>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-12 w-auto object-contain" />
      ) : null}
      <label className="text-sm font-medium">
        会社ロゴ（日報印刷に使います）
        <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="mt-1 block w-full text-sm" />
      </label>
      {state?.error ? (
        <p className="text-sm text-red-600">{toUserActionError(state.error, "設定を保存")}</p>
      ) : (
        <FormSuccessNotice pending={pending} error={state?.error} message="✓ 保存しました" />
      )}
      <button type="submit" disabled={pending} className="rounded-2xl bg-[var(--kb-ink)] font-medium text-white">
        {pending ? "保存中…" : "設定を保存"}
      </button>
    </form>
  );
}

export function InviteMemberForm({ organizationName }: { organizationName: string }) {
  const [state, action, pending] = useActionState(createInviteAction, null);
  const [copied, setCopied] = useState(false);
  const url = state && "url" in state ? state.url : null;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-base font-medium">{organizationName}にメンバーを招待</p>
      <form action={action} className="flex flex-col gap-3">
        <label className="text-sm font-medium">
          権限
          <select name="roleCode" defaultValue="worker" className="mt-1 w-full rounded-xl border border-zinc-200 px-3">
            <option value="worker">一般メンバー</option>
            <option value="supervisor">現場管理者</option>
            <option value="manager">管理者</option>
          </select>
        </label>
        {state && "error" in state && state.error ? (
          <p className="text-sm text-red-600">{toUserActionError(state.error, "招待リンクを作成")}</p>
        ) : null}
        <button type="submit" disabled={pending} className="rounded-2xl bg-[var(--kb-ink)] font-medium text-white">
          {pending ? "作成中…" : "招待リンクを作る"}
        </button>
      </form>
      {url ? (
        <div className="rounded-2xl bg-zinc-50 p-4">
          <ActionNotice>✓ 招待リンクを作成しました</ActionNotice>
          <button
            type="button"
            className="mt-4 w-full rounded-2xl bg-[var(--kb-ink)] py-3 text-base font-medium text-white"
            onClick={() => {
              void navigator.clipboard.writeText(url).then(() => setCopied(true));
            }}
          >
            {copied ? "コピーしました" : "リンクをコピー"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CopyInviteLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="mt-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium"
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => setCopied(true));
      }}
    >
      {copied ? "コピーしました" : "リンクをコピー"}
    </button>
  );
}

export function MembershipStatusForm({
  membershipId,
  nextStatus,
  label,
}: {
  membershipId: string;
  nextStatus: "active" | "disabled";
  label: string;
}) {
  const [state, action, pending] = useActionState(setMembershipStatusAction, null);
  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="status" value={nextStatus} />
      {state?.error ? <p className="mb-2 text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium"
      >
        {pending ? "更新中…" : label}
      </button>
    </form>
  );
}

