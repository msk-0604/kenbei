import Link from "next/link";

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "前の画面に戻る",
  action,
}: PageHeaderProps) {
  return (
    <section className="mb-8">
      {backHref ? (
        <Link
          href={backHref}
          className="tap-press mb-5 flex min-h-[4rem] w-full items-center justify-center rounded-2xl border-2 border-gray-300 bg-white px-5 text-xl font-bold text-navy-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
        >
          ← {backLabel}
        </Link>
      ) : null}
      <section className="flex flex-col gap-4">
        <section>
          <h1 className="text-[1.875rem] font-bold leading-tight text-navy-950">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-lg leading-relaxed text-gray-600">
              {description}
            </p>
          ) : null}
        </section>
        {action ? <section className="w-full">{action}</section> : null}
      </section>
    </section>
  );
}
