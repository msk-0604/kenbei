"use client";

import { useActionState } from "react";
import { createOrganizationAction } from "@/features/org/actions";

export function CreateOrganizationForm() {
  const [state, action, pending] = useActionState(createOrganizationAction, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        会社名
        <input
          name="name"
          type="text"
          required
          autoComplete="organization"
          className="rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900"
        />
      </label>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl bg-zinc-900 px-4 text-base font-medium text-white disabled:opacity-60"
      >
        {pending ? "作成中…" : "会社を作成して始める"}
      </button>
    </form>
  );
}
