import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CreateProjectForm } from "@/features/projects/forms";
import { can, requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const workspace = await requireWorkspace();
  if (!can(workspace, "project.create")) {
    return (
      <AppShell>
        <h1 className="text-3xl font-semibold tracking-tight">現場を作成</h1>
        <p className="mt-3 text-zinc-600">現場の作成権限がありません。</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <p className="text-sm text-zinc-500">
        <Link href="/projects">現場</Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">現場を作成</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600">現場名だけで作れます。住所などはあとから入力できます。</p>
      <section className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
        <CreateProjectForm />
      </section>
    </AppShell>
  );
}
