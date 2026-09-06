import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConfirmFlow } from "@/features/capture/confirm-flow";
import { getCaptureView } from "@/features/capture/queries";
import { requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireWorkspace();
  const { id } = await params;
  const capture = await getCaptureView(id);
  if (!capture) {
    notFound();
  }
  return (
    <AppShell>
      <p className="text-sm text-zinc-500">
        <Link href={`/projects/${capture.projectId}`}>現場</Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">確認</h1>
      {capture.transcript ? (
        <p className="mt-3 text-sm leading-6 text-zinc-600">{capture.transcript}</p>
      ) : null}
      <div className="mt-6">
        <ConfirmFlow captureId={capture.id} fields={capture.fields} graphApplied={Boolean(capture.graphAppliedAt)} />
      </div>
    </AppShell>
  );
}
