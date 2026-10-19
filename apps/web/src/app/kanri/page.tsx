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

type MenuItem = { href: string; label: string; note?: string; icon: LucideIcon };

/** 毎日使うもの：大きいタイルで並べる */
const DAILY: MenuItem[] = [
  { href: "/kanri/schedules", label: "全員の予定", note: "見る・変える", icon: CalendarDays },
  { href: "/sites", label: "現場と写真", note: "進み具合を見る", icon: Camera },
  { href: "/reports", label: "日報", note: "見る・出す", icon: FileText },
  { href: "/tasks", label: "残作業", note: "タスク", icon: ListChecks },
];

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

function StatTile({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-[var(--kb-line)]">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums text-gray-950">{value}</span>
        <span className="text-sm text-gray-600">{unit}</span>
      </p>
    </div>
  );
}

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

      {stats ? (
        <section aria-label="今日の現場">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="今日の予定" value={stats.schedulesToday} unit="件" />
            <StatTile label="作業を始めた" value={stats.startedToday} unit="件" />
            <StatTile label="写真（7日間）" value={stats.photos7d} unit="枚" />
            <StatTile label="日報（7日間）" value={stats.reports7d} unit="件" />
          </div>
        </section>
      ) : null}

      {setupState ? <SetupChecklistCard steps={setupSteps(setupState)} hasSample={setupState.hasSample} /> : null}

      <section aria-label="毎日使う">
        <div className="grid grid-cols-2 gap-3">
          {DAILY.map(({ href, label, note, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="tap-press flex min-h-28 flex-col justify-between rounded-3xl bg-[var(--kb-ink)] p-4 text-white"
            >
              <Icon className="h-7 w-7 text-sky-300" aria-hidden />
              <span>
                <span className="block text-lg font-bold leading-tight">{label}</span>
                {note ? <span className="block text-sm text-white/70">{note}</span> : null}
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
              className="tap-press flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4 text-base font-bold text-gray-950 ring-1 ring-[var(--kb-line)]"
            >
              <Icon className="h-5 w-5 shrink-0 text-[var(--kb-accent)]" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </section>

      <SiteProgressSummary summaries={progressSummaries} />

      <section>
        <h2 className="mb-2 text-base font-bold text-gray-700">設定</h2>
        <ul className="divide-y divide-[var(--kb-line)] overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--kb-line)]">
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
