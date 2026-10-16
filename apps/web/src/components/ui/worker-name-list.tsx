import { cn } from "@/lib/cn";

/** 作業員名を大きく並べて、ぱっと見で分かるようにする */
export function WorkerNameList({
  names,
  emptyLabel = "作業員は未割当",
  className,
}: {
  names: string[];
  emptyLabel?: string;
  className?: string;
}) {
  if (names.length === 0) {
    return (
      <p className={cn("text-base font-bold text-gray-500", className)}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {names.map((name) => (
        <li
          key={name}
          className="rounded-xl border-2 border-navy-200 bg-navy-900/5 px-3 py-2 text-lg font-bold text-navy-950"
        >
          {name}
        </li>
      ))}
    </ul>
  );
}
