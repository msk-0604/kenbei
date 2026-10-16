export function HintBox({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-2xl border-2 border-blue-200 bg-blue-50 px-5 py-5 text-xl leading-relaxed text-blue-900">
      {children}
    </section>
  );
}
