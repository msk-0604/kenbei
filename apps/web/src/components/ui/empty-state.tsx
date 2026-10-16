interface EmptyStateProps {
  title: string;
  description: string;
  steps?: string[];
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  steps,
  action,
}: EmptyStateProps) {
  return (
    <section className="rounded-2xl border-2 border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      <h3 className="text-xl font-bold text-navy-950">{title}</h3>
      <p className="mx-auto mt-3 max-w-md text-lg leading-relaxed text-gray-600">
        {description}
      </p>
      {steps && steps.length > 0 ? (
        <ol className="mx-auto mt-6 max-w-md space-y-3 text-left text-lg text-gray-700">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-base font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {action ? <section className="mt-8">{action}</section> : null}
    </section>
  );
}
