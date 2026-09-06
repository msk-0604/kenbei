"use client";

import { useTransition } from "react";
import { switchOrganizationAction } from "@/features/org/switch-org";
import type { WorkspaceOrg } from "@/lib/session";

export function OrgSwitcher({
  currentId,
  organizations,
}: {
  currentId: string;
  organizations: WorkspaceOrg[];
}) {
  const [pending, start] = useTransition();
  if (organizations.length < 2) {
    return null;
  }
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500">会社</span>
      <select
        className="rounded-xl border border-zinc-200 bg-white px-2 py-1"
        defaultValue={currentId}
        disabled={pending}
        onChange={(event) => {
          const value = event.target.value;
          start(() => {
            void switchOrganizationAction(value);
          });
        }}
      >
        {organizations.map((item) => (
          <option key={item.organizationId} value={item.organizationId}>
            {item.organizationName}
          </option>
        ))}
      </select>
    </label>
  );
}
