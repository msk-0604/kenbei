import Link from "next/link";
import { setupProgress, type SetupStep } from "@/features/help/setup-checklist";

/** 管理画面の上に出す「はじめにやること」 */
export function SetupChecklistCard({ steps }: { steps: SetupStep[] }) {
  const progress = setupProgress(steps);
  if (progress.complete) {
    return null;
  }
  const next = steps.find((step) => !step.done);
  return (
    <section className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-4" aria-labelledby="setup-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="setup-title" className="text-xl font-bold text-gray-950">
          はじめにやること
        </h2>
        <p className="text-base font-bold tabular-nums text-sky-800">
          {progress.done} / {progress.total}
        </p>
      </div>
      <ol className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className={`tap-press flex min-h-14 items-start gap-3 rounded-xl px-3 py-2 ${
                step === next ? "bg-white ring-2 ring-sky-400" : "bg-white/60"
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                  step.done ? "bg-emerald-600 text-white" : "bg-white text-gray-500 ring-2 ring-gray-300"
                }`}
              >
                {step.done ? "✓" : ""}
              </span>
              <span className="min-w-0">
                <span className={`block text-lg font-bold ${step.done ? "text-gray-500 line-through" : "text-gray-950"}`}>
                  {step.label}
                  <span className="sr-only">{step.done ? "（済み）" : "（まだ）"}</span>
                </span>
                {step.done ? null : <span className="block text-base text-gray-700">{step.detail}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-base text-gray-700">
        わからないときは{" "}
        <Link href="/help" className="font-bold underline">
          使い方・よくある質問
        </Link>
      </p>
    </section>
  );
}
