import Link from "next/link";
import { PROJECT_STATUS_LABELS } from "@kensapo/domain";
import { AppShell } from "@/components/app-shell";
import { EmptyGuide } from "@/components/empty-guide";
import { CreateProjectForm } from "@/features/projects/forms";
import { listProjects } from "@/features/projects/queries";
import { can, requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const workspace = await requireWorkspace();
  const projects = await listProjects();
  const canCreate = can(workspace, "project.create");

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">現場</h1>
      {canCreate ? (
        <section className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
          <h2 className="mb-3 text-base font-medium">現場を作成</h2>
          <CreateProjectForm />
        </section>
      ) : null}
      {projects.length === 0 ? (
        <div className="mt-6">
          <EmptyGuide
            title="まだ現場がありません"
            body="上の欄に現場名を入れて、最初の現場を作りましょう。"
            action={canCreate ? undefined : <p className="text-sm text-zinc-500">現場の作成権限がありません。</p>}
          />
        </div>
      ) : null}
      <ul className="mt-6 flex flex-col gap-3">
        {projects.map((project) => (
          <li key={project.id}>
            <Link href={`/projects/${project.id}`} className="kb-tap block rounded-3xl bg-white p-5 ring-1 ring-[var(--kb-line)]">
              <p className="text-lg font-medium">{project.name}</p>
              <p className="mt-1 text-sm text-zinc-500">
                {PROJECT_STATUS_LABELS[project.status as keyof typeof PROJECT_STATUS_LABELS] ?? project.status}
                {project.customerName ? ` / ${project.customerName}` : ""}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{project.address ?? "住所未登録"}</p>
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
