"use client";

import { useActionState } from "react";
import { SYSTEM_ROLE_CODES } from "@kensapo/domain";
import { assignMemberAction, createProjectAction, updateProjectAction } from "@/features/projects/actions";
import type { AssignmentRow, OrgMemberOption } from "@/features/projects/queries";

export function CreateProjectForm() {
  const [state, action, pending] = useActionState(createProjectAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        name="name"
        required
        placeholder="現場名"
        className="rounded-xl border border-zinc-200 bg-white px-4 text-base"
      />
      <input
        name="customerName"
        placeholder="顧客名"
        className="rounded-xl border border-zinc-200 bg-white px-4 text-base"
      />
      <input
        name="address"
        placeholder="住所"
        className="rounded-xl border border-zinc-200 bg-white px-4 text-base"
      />
      <input
        name="workSummary"
        placeholder="工事内容"
        className="rounded-xl border border-zinc-200 bg-white px-4 text-base"
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-zinc-600">
          工期開始
          <input type="date" name="plannedStartOn" className="mt-1 w-full rounded-xl border border-zinc-200 px-3" />
        </label>
        <label className="text-sm text-zinc-600">
          工期終了
          <input type="date" name="plannedEndOn" className="mt-1 w-full rounded-xl border border-zinc-200 px-3" />
        </label>
      </div>
      <select name="status" defaultValue="active" className="rounded-xl border border-zinc-200 bg-white px-3 text-base">
        <option value="draft">準備中</option>
        <option value="active">施工中</option>
        <option value="on_hold">一時停止</option>
        <option value="completed">完了</option>
      </select>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-2xl bg-zinc-900 font-medium text-white">
        {pending ? "作成中…" : "現場を作る"}
      </button>
    </form>
  );
}

export function EditProjectForm({
  projectId,
  name,
  address,
  workSummary,
  cautionNote,
  customerName,
  status,
  plannedStartOn,
  plannedEndOn,
}: {
  projectId: string;
  name: string;
  address: string | null;
  workSummary: string | null;
  cautionNote: string | null;
  customerName: string | null;
  status: string;
  plannedStartOn: string | null;
  plannedEndOn: string | null;
}) {
  const [state, action, pending] = useActionState(updateProjectAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input name="name" required defaultValue={name} className="rounded-xl border border-zinc-200 bg-white px-4 text-base" />
      <input
        name="customerName"
        defaultValue={customerName ?? ""}
        placeholder="顧客名"
        className="rounded-xl border border-zinc-200 bg-white px-4 text-base"
      />
      <input
        name="address"
        defaultValue={address ?? ""}
        placeholder="住所"
        className="rounded-xl border border-zinc-200 bg-white px-4 text-base"
      />
      <input
        name="workSummary"
        defaultValue={workSummary ?? ""}
        placeholder="工事内容"
        className="rounded-xl border border-zinc-200 bg-white px-4 text-base"
      />
      <textarea
        name="cautionNote"
        defaultValue={cautionNote ?? ""}
        placeholder="注意事項"
        rows={3}
        className="min-h-24 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-zinc-600">
          工期開始
          <input
            type="date"
            name="plannedStartOn"
            defaultValue={plannedStartOn ?? ""}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3"
          />
        </label>
        <label className="text-sm text-zinc-600">
          工期終了
          <input
            type="date"
            name="plannedEndOn"
            defaultValue={plannedEndOn ?? ""}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3"
          />
        </label>
      </div>
      <select name="status" defaultValue={status} className="rounded-xl border border-zinc-200 bg-white px-3 text-base">
        <option value="draft">準備中</option>
        <option value="active">施工中</option>
        <option value="on_hold">一時停止</option>
        <option value="completed">完了</option>
      </select>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-2xl border border-zinc-200 bg-white font-medium">
        {pending ? "保存中…" : "保存"}
      </button>
    </form>
  );
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  executive: "経営",
  manager: "管理",
  supervisor: "監督",
  worker: "作業",
  office: "事務",
  partner: "協力会社",
  guest: "ゲスト",
};

export function AssignMemberForm({
  projectId,
  members,
}: {
  projectId: string;
  members: OrgMemberOption[];
}) {
  const [state, action, pending] = useActionState(assignMemberAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <select name="membershipId" required className="rounded-xl border border-zinc-200 bg-white px-3 text-base">
        <option value="">メンバー</option>
        {members.map((member) => (
          <option key={member.membershipId} value={member.membershipId}>
            {member.displayName}
          </option>
        ))}
      </select>
      <select
        name="roleInProject"
        required
        defaultValue="worker"
        className="rounded-xl border border-zinc-200 bg-white px-3 text-base"
      >
        {SYSTEM_ROLE_CODES.map((code) => (
          <option key={code} value={code}>
            {ROLE_LABEL[code] ?? code}
          </option>
        ))}
      </select>
      <input type="date" name="startsOn" className="rounded-xl border border-zinc-200 bg-white px-3 text-base" />
      <input type="date" name="endsOn" className="rounded-xl border border-zinc-200 bg-white px-3 text-base" />
      <select name="status" className="rounded-xl border border-zinc-200 bg-white px-3 text-base">
        <option value="active">有効</option>
        <option value="inactive">無効</option>
      </select>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-2xl bg-zinc-900 font-medium text-white">
        {pending ? "割り当て中…" : "割り当て"}
      </button>
    </form>
  );
}

export function AssignmentList({ assignments }: { assignments: AssignmentRow[] }) {
  if (assignments.length === 0) {
    return <p className="text-sm text-zinc-500">まだ割り当てがありません。</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {assignments.map((row) => (
        <li key={row.id} className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm">
          <p className="font-medium">{row.displayName}</p>
          <p className="text-zinc-500">
            {ROLE_LABEL[row.roleInProject] ?? row.roleInProject} / {row.status === "active" ? "有効" : "無効"}
            {row.startsOn ? ` / ${row.startsOn}` : ""}
            {row.endsOn ? `〜${row.endsOn}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
