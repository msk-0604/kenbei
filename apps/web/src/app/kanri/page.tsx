import Link from "next/link";
import { SiteProgressSummary } from "@/features/sites/site-progress-summary";
import { getAllProjectsProgressSummaries } from "@/features/sites/queries";
import { can, requireSiteAdmin } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/kanri/schedules", label: "全員の予定を見る・変更する" },
  { href: "/sites/new", label: "現場を登録する" },
  { href: "/workers/new", label: "作業員を登録する" },
  { href: "/kanri/import", label: "Excel から作業員・現場をまとめて取り込む" },
  { href: "/sites", label: "現場の進捗と写真を確認する" },
  { href: "/sites?intent=process", label: "工程を変更する" },
  { href: "/kanri/archive", label: "完了した現場の保存を見る" },
  { href: "/settings", label: "通知の設定" },
];

export default async function KanriHomePage() {
  const workspace = await requireSiteAdmin();
  const progressSummaries = await getAllProjectsProgressSummaries().catch(() => []);
  const more = [
    { href: "/kanri/presets", label: "よく使う工程の候補を変更する" },
    { href: "/reports", label: "日報を見る・出す" },
    { href: "/tasks", label: "タスク（残作業）" },
    ...(can(workspace, "member.manage") ? [{ href: "/settings/members", label: "メンバーの招待・権限" }] : []),
    ...(can(workspace, "org.manage") ? [{ href: "/settings/billing", label: "ご契約・お支払い" }] : []),
    { href: "/account", label: "そのほかのメニュー" },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-bold text-gray-950">管理</h1>
        <p className="mt-2 text-lg text-gray-700">現場、予定、従業員の登録はここから行います。</p>
      </header>
      <ul className="space-y-3">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="tap-press flex min-h-14 items-center rounded-2xl border-2 border-gray-300 bg-white px-4 text-lg font-bold text-gray-950"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <SiteProgressSummary summaries={progressSummaries} />
      <section>
        <h2 className="mb-3 text-lg font-bold text-gray-800">そのほか</h2>
        <ul className="space-y-3">
          {more.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="tap-press flex min-h-14 items-center rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 text-lg font-bold text-gray-800"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <Link href="/today" className="inline-flex min-h-12 items-center text-lg font-bold text-gray-700">
        今日の予定へ戻る
      </Link>
    </div>
  );
}
