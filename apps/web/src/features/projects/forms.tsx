"use client";

import { useActionState } from "react";
import { SYSTEM_ROLE_CODES } from "@kensapo/domain";
import { assignMemberAction } from "@/features/projects/actions";
import type { AssignmentRow, OrgMemberOption } from "@/features/projects/queries";

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
