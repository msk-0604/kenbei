"use client";

import { useActionState, useState } from "react";
import { createInviteAction, updateCompanySettingsAction } from "@/features/settings/actions";

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
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-2xl bg-[var(--kb-ink)] font-medium text-white">
        {pending ? "保存中…" : "会社設定を保存"}
      </button>
    </form>
  );
}

export function InviteMemberForm() {
  const [state, action, pending] = useActionState(createInviteAction, null);
  const [copied, setCopied] = useState(false);
  const url = state && "url" in state ? state.url : null;
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          placeholder="member@example.com"
          className="rounded-xl border border-zinc-200 px-4"
        />
        <select name="roleCode" defaultValue="supervisor" className="rounded-xl border border-zinc-200 px-3">
          <option value="supervisor">現場監督（MANAGER）</option>
          <option value="manager">管理者（ADMIN）</option>
          <option value="worker">メンバー</option>
          <option value="office">事務</option>
          <option value="executive">経営</option>
        </select>
        {state && "error" in state && state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <button type="submit" disabled={pending} className="rounded-2xl bg-[var(--kb-ink)] font-medium text-white">
          {pending ? "作成中…" : "招待リンクを作る"}
        </button>
      </form>
      {url ? (
        <div className="rounded-2xl bg-zinc-50 p-4 text-sm">
          <p className="font-medium">招待リンク</p>
          <p className="mt-2 break-all text-zinc-600">{url}</p>
          <button
            type="button"
            className="mt-3 rounded-xl border border-zinc-200 bg-white px-3"
            onClick={() => {
              void navigator.clipboard.writeText(url).then(() => setCopied(true));
            }}
          >
            {copied ? "コピーしました" : "コピー"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
