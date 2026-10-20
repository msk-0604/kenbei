import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Bell,
  Building2,
  CalendarDays,
  Camera,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Ellipsis,
  FileText,
  ListChecks,
  ListOrdered,
  UserPlus,
  Users,
  Workflow,
} from "lucide-react";
import { SetupChecklistCard } from "@/features/help/setup-checklist-card";
import { setupSteps } from "@/features/help/setup-checklist";
import { getSetupState } from "@/features/help/setup-queries";
import { contractBadge } from "@/features/kanri/contract-badge";
import { getKanriTodayStats } from "@/features/kanri/today-stats";
import { SiteProgressSummary } from "@/features/sites/site-progress-summary";
import { getAllProjectsProgressSummaries } from "@/features/sites/queries";
import { can, requireSiteAdmin } from "@/lib/authz-guard";
import { getEntitlement } from "@/lib/entitlement";

export const dynamic = "force-dynamic";

type MenuItem = { href: string; label: string; icon: LucideIcon };

/** ときどき使う登録 */
const REGISTER: MenuItem[] = [
  { href: "/sites/new", label: "現場を登録", icon: Building2 },
  { href: "/workers/new", label: "作業員を登録", icon: UserPlus },
];

const TONE: Record<"ok" | "trial" | "warn", string> = {
  ok: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  trial: "bg-sky-50 text-sky-900 ring-sky-200",
  warn: "bg-amber-50 text-amber-900 ring-amber-200",
};

export default async function KanriHomePage() {
  const workspace = await requireSiteAdmin();
  const canBilling = can(workspace, "org.manage");
  const [progressSummaries, setupState, stats, entitlement] = await Promise.all([
    getAllProjectsProgressSummaries().catch(() => []),
    getSetupState(workspace.organizationId).catch(() => null),
    getKanriTodayStats(workspace.organizationId).catch(() => null),
    canBilling ? getEntitlement(workspace.organizationId).catch(() => null) : Promise.resolve(null),
  ]);
  const badge = entitlement
    ? contractBadge({
        access: entitlement.access,
        trialDaysLeft: entitlement.trialDaysLeft,
        trialEndsAt: entitlement.trialEndsAt,
        currentPeriodEnd: entitlement.currentPeriodEnd,
        cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
        invoicePending: entitlement.invoicePending,
      })
    : null;

  // 毎日使うもの。数字は自分の会社の今の状態なので、開くたびに中身が変わる
  const daily: (MenuItem & { value: number | null; unit: string; caption: string })[] = [
    {
      href: "/kanri/schedules",
      label: "全員の予定",
      icon: CalendarDays,
      value: stats?.schedulesToday ?? null,
      unit: "件",
      caption: stats ? `今日（作業開始 ${stats.startedToday}件）` : "今日",
    },
    { href: "/sites", label: "現場の写真", icon: Camera, value: stats?.photos7d ?? null, unit: "枚", caption: "この7日間" },
    { href: "/reports", label: "日報", icon: FileText, value: stats?.reports7d ?? null, unit: "件", caption: "この7日間" },
    { href: "/tasks", label: "残作業", icon: ListChecks, value: stats?.openTasks ?? null, unit: "件", caption: "まだ終わっていない" },
  ];

  const settings: MenuItem[] = [
    { href: "/kanri/presets", label: "よく使う工程の候補", icon: ListOrdered },
    { href: "/sites?intent=process", label: "現場の工程を変える", icon: Workflow },
    { href: "/kanri/archive", label: "完了した現場の保存", icon: Archive },
    { href: "/settings", label: "通知・ログインの設定", icon: Bell },
    ...(can(workspace, "member.manage") ? [{ href: "/settings/members", label: "メンバーの招待・権限", icon: Users }] : []),
    ...(canBilling ? [{ href: "/settings/billing", label: "ご契約・お支払い・領収書", icon: CreditCard }] : []),
    { href: "/help", label: "使い方・よくある質問", icon: CircleHelp },
    { href: "/account", label: "そのほかのメニュー", icon: Ellipsis },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-600">{workspace.organizationName}</p>
          <h1 className="text-3xl font-bold text-gray-950">管理</h1>
        </div>
        {badge ? (
          <Link
            href="/settings/billing"
            className={`tap-press flex items-center gap-2 rounded-full px-4 py-2 text-sm ring-1 ${TONE[badge.tone]}`}
            data-testid="contract-badge"
          >
            <CreditCard className="h-4 w-4 shrink-0" aria-hidden />
            <span className="font-bold">{badge.label}</span>
            <span className="hidden opacity-80 sm:inline">{badge.detail}</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        ) : null}
      </header>

      {setupState ? <SetupChecklistCard steps={setupSteps(setupState)} hasSample={setupState.hasSample} /> : null}

      <section aria-label="毎日使う">
        <div className="grid grid-cols-2 gap-3">
          {daily.map(({ href, label, icon: Icon, value, unit, caption }) => (
            <Link
              key={href}
              href={href}
              className="tap-press flex flex-col gap-3 rounded-xl border border-gray-300 bg-white p-4 text-gray-950"
            >
              <span className="flex items-center gap-2 text-base font-bold">
                <Icon className="h-5 w-5 shrink-0 text-gray-700" aria-hidden />
                {label}
              </span>
              <span>
                <span className="text-3xl font-bold tabular-nums">{value ?? "—"}</span>
                <span className="ml-1 text-sm text-gray-600">{unit}</span>
                <span className="block text-xs text-gray-500">{caption}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="登録する">
        <div className="grid grid-cols-2 gap-3">
          {REGISTER.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="tap-press flex min-h-14 items-center gap-2 whitespace-nowrap rounded-xl border border-gray-300 bg-white px-3 text-base font-bold text-gray-950"
            >
              <Icon className="h-5 w-5 shrink-0 text-gray-700" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </section>

      <SiteProgressSummary summaries={progressSummaries} />

      <section>
        <h2 className="mb-2 text-base font-bold text-gray-700">設定</h2>
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-300 bg-white">
          {settings.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="tap-press flex min-h-14 items-center gap-3 px-4 text-base font-medium text-gray-900">
                <Icon className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
                <span className="flex-1">{label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
