import Link from "next/link";
import type { OnboardingFlags } from "@kensapo/domain";
import { CREATE_PROJECT_PATH } from "@/features/projects/routes";

const ITEMS: {
  key: keyof OnboardingFlags | "hasReport";
  label: string;
  note?: string;
  href: string;
}[] = [
  { key: "hasProject", label: "最初の現場", href: CREATE_PROJECT_PATH },
  { key: "hasPhoto", label: "最初の写真", href: "/photos/upload" },
  { key: "hasTask", label: "最初の作業", href: "/#today-add-task" },
  { key: "hasReport", label: "最初の日報", href: "/reports" },
  {
    key: "hasInviteOrMember",
    label: "チームで同じ流れを使う",
    note: "現場の写真・残作業・進捗・日報を、メンバーと同じ場所で共有できます。",
    href: "/settings",
  },
];

export function OnboardingChecklist({
  flags,
  complete,
  firstProjectId,
  hasReport = false,
}: {
  flags: OnboardingFlags;
  complete: boolean;
  firstProjectId?: string | null;
  hasReport?: boolean;
}) {
  if (complete) {
    return null;
  }
  const doneOf = (key: (typeof ITEMS)[number]["key"]) =>
    key === "hasReport" ? hasReport : Boolean(flags[key]);
  const experienceReady = flags.hasProject && flags.hasPhoto && flags.hasTask;
  const visible = experienceReady
    ? ITEMS.filter((item) => item.key === "hasInviteOrMember")
    : ITEMS;

  return (
    <section className="rounded-3xl bg-[var(--kb-card)] p-5 ring-1 ring-[var(--kb-line)]">
      <h2 className="text-lg font-semibold">{experienceReady ? "チームで同じ流れを使う" : "はじめの流れ"}</h2>
      <p className="mt-1 text-sm leading-6 text-zinc-500">
        {experienceReady
          ? "現場の写真・残作業・進捗・日報を、メンバーと同じ場所で共有できます。"
          : "現場 → 写真 → 作業 → 日報 → チーム の順です。"}
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {visible.map((item, index) => {
          const done = doneOf(item.key);
          const href =
            item.key === "hasTask"
              ? "/#today-add-task"
              : item.key === "hasPhoto"
                ? firstProjectId
                  ? `/photos/upload?projectId=${firstProjectId}`
                  : "/photos/upload"
                : item.href;
          return (
            <li key={item.key}>
              <Link
                href={href}
                className={`kb-tap flex min-h-12 flex-col justify-center rounded-2xl px-4 py-3 ${
                  done ? "bg-[#f3eee6] text-zinc-500" : "bg-white ring-1 ring-[var(--kb-line)]"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-medium text-[var(--kb-ink)]">
                    {experienceReady ? item.label : `${index + 1}. ${item.label}`}
                  </span>
                  <span className={`shrink-0 text-sm ${done ? "text-emerald-700" : "text-[var(--kb-amber)]"}`}>
                    {done ? "完了" : "次へ"}
                  </span>
                </span>
                {item.note && !experienceReady ? (
                  <span className="mt-1 text-sm font-normal leading-6 text-zinc-500">{item.note}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
