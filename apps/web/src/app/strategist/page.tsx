import { AppShell } from "@/components/app-shell";
import { StrategistForm } from "@/features/strategist/form";
import { listProjectOptions } from "@/features/projects/queries";
import { requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function StrategistPage() {
  await requireWorkspace();
  const projects = await listProjectOptions();
  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-sm font-medium tracking-wide text-[var(--kb-amber)]">AI軍師</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">現場に、軍師を。</h1>
        <p className="mt-2 max-w-xl text-base text-zinc-600">
          この会社のデータだけを読んで答えます。日報・タスク・写真分類は確認してから実行。削除・確定・課金はしません。
        </p>
      </header>
      <StrategistForm projects={projects} />
    </AppShell>
  );
}
