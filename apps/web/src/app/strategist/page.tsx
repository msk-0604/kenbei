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
        この会社のデータだけを読みます。自然言語で聞いてください。日報・タスク・写真分類は確認後のみ実行し、削除・確定・課金はしません。
      </p>
      <div className="mt-6">
        <StrategistForm projects={projects.map((item) => ({ id: item.id, name: item.name }))} />
      </div>
    </AppShell>
  );
}
