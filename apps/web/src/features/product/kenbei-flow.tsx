import { KENBEI_FLOW_STEPS, LEGACY_FLOW_STEPS } from "@/features/product/workflow";

export function KenbeiFlow({
  compare = false,
  tone = "light",
}: {
  compare?: boolean;
  tone?: "light" | "dark";
}) {
  const muted = tone === "dark" ? "text-white/55" : "text-zinc-500";
  const strong = tone === "dark" ? "text-white" : "text-[var(--kb-ink)]";
  return (
    <div className="flex flex-col gap-3">
      {compare ? (
        <div>
          <p className={`text-xs font-medium ${muted}`}>従来</p>
          <FlowLine steps={[...LEGACY_FLOW_STEPS]} className={muted} />
        </div>
      ) : null}
      <div>
        {compare ? <p className={`text-xs font-medium ${muted}`}>KENBEI</p> : null}
        <FlowLine steps={[...KENBEI_FLOW_STEPS]} className={strong} />
      </div>
    </div>
  );
}

function FlowLine({ steps, className }: { steps: string[]; className: string }) {
  return (
    <p className={`mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-medium leading-6 ${className}`}>
      {steps.map((step, index) => (
        <span key={step} className="inline-flex items-center gap-1.5">
          {index > 0 ? <span aria-hidden className="font-normal opacity-50">→</span> : null}
          {step}
        </span>
      ))}
    </p>
  );
}
