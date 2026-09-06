import Link from "next/link";
import type { OnboardingFlags } from "@kensapo/domain";

const ITEMS: { key: keyof OnboardingFlags; label: string; href: string }[] = [
  { key: "hasOrganization", label: "会社作成", href: "/onboarding" },
  { key: "hasProject", label: "最初の現場", href: "/projects" },
  { key: "hasInviteOrMember", label: "メンバー招待", href: "/settings" },
  { key: "hasPhoto", label: "最初の写真", href: "/photos" },
  { key: "hasTask", label: "最初のタスク", href: "/projects" },
];

export function OnboardingChecklist({
  flags,
  complete,
}: {
  flags: OnboardingFlags;
  complete: boolean;
}) {
  if (complete) {
    return (
      <section className="rounded-3xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
        <p className="text-lg font-semibold">KENBEIの準備ができました</p>
        <p className="mt-1 text-sm text-emerald-900">今日の写真と日報から始められます。</p>
      </section>
    );
  }
  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
      <h2 className="text-lg font-medium">はじめの5ステップ</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {ITEMS.map((item) => (
          <li key={item.key}>
            <Link href={item.href} className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
              <span>{item.label}</span>
              <span>{flags[item.key] ? "完了" : "これから"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
