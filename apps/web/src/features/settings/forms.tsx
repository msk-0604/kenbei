"use client";

import { useActionState, useState } from "react";
import {
  cancelInviteAction,
  createInviteAction,
  resendInviteAction,
  setMembershipStatusAction,
  updateCompanySettingsAction,
} from "@/features/settings/actions";
import { inviteMailFailedMessage } from "@kensapo/domain";
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
  const result = state && "url" in state ? state : null;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-base font-medium">{organizationName}にメンバーを招待</p>
      <form action={action} className="flex flex-col gap-3">
        <label className="text-sm font-medium">
          メールアドレス
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="example@company.jp"
            className="mt-1 w-full rounded-xl border border-zinc-200 px-4"
          />
        </label>
        <label className="text-sm font-medium">
          権限
          <select name="roleCode" defaultValue="worker" className="mt-1 w-full rounded-xl border border-zinc-200 px-3">
            <option value="worker">一般メンバー</option>
            <option value="supervisor">現場管理者</option>
            <option value="manager">管理者</option>
          </select>
        </label>
        {state && "error" in state && state.error ? (
          <p className="text-sm text-red-600">{toUserActionError(state.error, "招待メールを送る")}</p>
        ) : null}
        <button type="submit" disabled={pending} className="rounded-2xl bg-[var(--kb-ink)] font-medium text-white">
          {pending ? "送信中…" : "招待メールを送る"}
        </button>
      </form>
      {result ? (
        <div className="rounded-2xl bg-zinc-50 p-4">
          {result.mailed ? (
            <ActionNotice>{`✓ ${result.email} に招待メールを送りました`}</ActionNotice>
          ) : (
            <p className="text-sm leading-6 text-zinc-700">{inviteMailFailedMessage()}</p>
          )}
          <button
            type="button"
            className="mt-4 w-full rounded-2xl border border-zinc-200 bg-white py-3 text-base font-medium"
            onClick={() => {
              void navigator.clipboard.writeText(result.url).then(() => setCopied(true));
            }}
          >
            {copied ? "コピーしました" : "招待リンクをコピー"}
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

export function PendingInvitesList({
  invites,
  appUrl,
}: {
  invites: { id: string; email: string | null; roleName: string; expiresAt: string; token: string }[];
  appUrl: string;
}) {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const visible = invites.filter((invite) => !hiddenIds.includes(invite.id));
  return (
    <div>
      {notice ? <p className="mb-3 text-sm font-medium">{notice}</p> : null}
      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">招待中の人はいません。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((invite) => (
            <li key={invite.id} className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm">
              <p className="font-medium">{invite.email || "リンク招待"}</p>
              <p className="text-zinc-500">{invite.roleName}</p>
              <p className="text-zinc-500">有効期限 {invite.expiresAt.slice(0, 10)}</p>
              {invite.email ? <ResendInviteButton inviteId={invite.id} onNotice={setNotice} /> : null}
              <CopyInviteLinkButton url={`${appUrl}/join?token=${invite.token}`} />
              <CancelInviteButton
                inviteId={invite.id}
                onCanceled={() => {
                  setHiddenIds((current) => [...current, invite.id]);
                  setNotice("✓ 招待を取り消しました");
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResendInviteButton({
  inviteId,
  onNotice,
}: {
  inviteId: string;
  onNotice: (message: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        className="mt-2 block rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium"
        onClick={() => {
          setPending(true);
          setError(null);
          const form = new FormData();
          form.set("inviteId", inviteId);
          void resendInviteAction(null, form).then((result) => {
            setPending(false);
            if (result && "mailed" in result && result.mailed) {
              onNotice("✓ 招待メールを再送しました");
              return;
            }
            if (result && "mailed" in result) {
              setError(inviteMailFailedMessage());
              return;
            }
            setError(result && "error" in result ? result.error : "再送できませんでした。");
          });
        }}
      >
        {pending ? "再送中…" : "招待メールを再送"}
      </button>
    </div>
  );
}

function CancelInviteButton({ inviteId, onCanceled }: { inviteId: string; onCanceled: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (confirming) {
    return (
      <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
        <p className="text-sm leading-6 text-zinc-700">この招待リンクを無効にしますか？</p>
        <p className="mt-1 text-sm leading-6 text-zinc-700">無効にすると、このリンクから参加できなくなります。</p>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            className="rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium"
            onClick={() => {
              setConfirming(false);
              setError(null);
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-xl bg-[var(--kb-ink)] px-3 text-sm font-medium text-white"
            onClick={() => {
              setPending(true);
              const form = new FormData();
              form.set("inviteId", inviteId);
              void cancelInviteAction(null, form).then((result) => {
                if (result && "canceled" in result) {
                  onCanceled();
                  return;
                }
                setPending(false);
                setError(result && "error" in result ? result.error : "招待を取り消せませんでした。");
              });
            }}
          >
            {pending ? "取り消し中…" : "招待を取り消す"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="mt-2 block rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium"
      onClick={() => setConfirming(true)}
    >
      招待を取り消す
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

