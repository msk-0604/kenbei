import { AppShell } from "@/components/app-shell";
import { StrategistForm } from "@/features/strategist/form";
import { listProjects } from "@/features/projects/queries";
import { requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function StrategistPage() {
  await requireWorkspace();
  const projects = await listProjects();
  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">AI軍師</h1>
      <p className="mt-2 text-zinc-600">
        この会社のデータだけを使います。AIは下書きと提案のみで、承認・削除・課金・メンバー変更はしません。
      </p>
      <div className="mt-6">
        <StrategistForm projects={projects.map((item) => ({ id: item.id, name: item.name }))} />
      </div>
    </AppShell>
  );
}
