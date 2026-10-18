import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { classifyBillingAccess, KENBEI_MONTHLY_PRICE_JPY } from "@kensapo/domain";
import {
  classifyOrgHealth,
  describeOrgSource,
  isPlatformAdminEmail,
  summarizeOverview,
  type OrgHealthKind,
  type OrgOverviewRow,
  type OrgSourceRow,
} from "@/features/ops/org-health";
import { readServerEnv } from "@/lib/server-env";
import { getWorkspace } from "@/lib/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "運営 | KENBEI", robots: { index: false } };

const FILTERS = [
  { key: "follow", label: "連絡する" },
  { key: "all", label: "すべて" },
  { key: "paying", label: "契約中" },
  { key: "trial", label: "お試し中" },
] as const;

const BADGE: Record<OrgHealthKind, string> = {
  unpaid: "bg-red-100 text-red-800",
  canceling: "bg-red-50 text-red-700",
  setup: "bg-amber-100 text-amber-900",
  trial_ending: "bg-amber-100 text-amber-900",
  inactive: "bg-orange-100 text-orange-900",
  healthy: "bg-emerald-100 text-emerald-800",
  lost: "bg-zinc-100 text-zinc-600",
};

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(new Date(iso));
}

/** KENBEI を売る側（運営）の画面。全社の利用状況と、連絡すべき会社を出す。 */
export default async function OpsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const workspace = await getWorkspace();
  if (!workspace) {
    redirect("/login?next=/ops");
  }
  if (!isPlatformAdminEmail(workspace.email, readServerEnv("PLATFORM_ADMIN_EMAILS"))) {
    notFound();
  }
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return <p className="p-6">SUPABASE_SERVICE_ROLE_KEY が未設定です。</p>;
  }
  const { data, error } = await admin.rpc("platform_org_overview");
  if (error) {
    return (
      <p className="p-6" role="alert">
        集計を読めませんでした（DB の移行 20261017120000_platform_org_overview.sql が未適用かもしれません）。
      </p>
    );
  }
  const rows = (data as OrgOverviewRow[] | null) ?? [];
  const now = new Date();
  // どこから来た会社か（お試し開始の記録に残った流入元）。読めなくても画面は出す。
  const sourceResult = await admin
    .from("sales_funnel_events")
    .select("organization_id, utm_source, utm_medium, utm_campaign, utm_content")
    .eq("event_kind", "trial_started")
    .not("organization_id", "is", null);
  const sources = new Map(
    ((sourceResult.data as OrgSourceRow[] | null) ?? []).map((source) => [source.organization_id ?? "", source]),
  );
  const fromForm = rows.filter((row) => describeOrgSource(sources.get(row.organization_id)).fromForm);
  const fromFormPaying = fromForm.filter(
    (row) =>
      classifyBillingAccess({ planCode: row.plan_code, status: row.billing_status, trialEndsAt: row.trial_ends_at, now }) ===
      "paid_active",
  ).length;
  const summary = summarizeOverview(rows, KENBEI_MONTHLY_PRICE_JPY, now);
  const filter = (await searchParams).filter ?? "follow";
  const items = rows
    .map((row) => ({
      row,
      health: classifyOrgHealth(row, now),
      access: classifyBillingAccess({ planCode: row.plan_code, status: row.billing_status, trialEndsAt: row.trial_ends_at, now }),
    }))
    .filter(({ health, access }) => {
      if (filter === "follow") return health.needsFollowUp;
      if (filter === "paying") return access === "paid_active";
      if (filter === "trial") return access === "trial_active";
      return true;
    });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-bold text-gray-950">運営</h1>
        <p className="mt-2 text-gray-700">全社の利用状況。「連絡する」に出た会社へ電話・メールしてください。</p>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "登録", value: `${summary.total}社` },
          { label: "契約中", value: `${summary.paying}社` },
          { label: "お試し中", value: `${summary.trial}社` },
          { label: "月の売上（目安）", value: `${summary.monthlyRevenueJpy.toLocaleString("ja-JP")}円` },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
            <dt className="text-sm text-gray-600">{item.label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-950">{item.value}</dd>
          </div>
        ))}
      </dl>

      <p className="rounded-2xl bg-white p-4 text-sm text-gray-700 ring-1 ring-gray-200">
        フォーム営業から来た会社：<span className="font-bold tabular-nums text-gray-950">{fromForm.length}社</span>（うち契約中{" "}
        <span className="font-bold tabular-nums text-gray-950">{fromFormPaying}社</span>）。識別コードは営業記録シートのコードと同じです。
      </p>

      <nav className="flex flex-wrap gap-2" aria-label="絞り込み">
        {FILTERS.map((item) => (
          <Link
            key={item.key}
            href={`/ops?filter=${item.key}`}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              filter === item.key ? "bg-gray-950 text-white" : "bg-white text-gray-800 ring-1 ring-gray-300"
            }`}
          >
            {item.label}
            {item.key === "follow" ? `（${summary.followUp}）` : ""}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-gray-700 ring-1 ring-gray-200">該当する会社はありません。</p>
      ) : (
        <ul className="space-y-3">
          {items.map(({ row, health }) => {
            const source = describeOrgSource(sources.get(row.organization_id));
            return (
            <li key={row.organization_id} className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-bold text-gray-950">{row.name}</p>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${BADGE[health.kind]}`}>{health.label}</span>
              </div>
              {health.action ? <p className="mt-1 text-sm font-medium text-gray-800">→ {health.action}</p> : null}
              <p className="mt-2 text-sm text-gray-600">
                {row.owner_email ? (
                  <a href={`mailto:${row.owner_email}`} className="underline">
                    {row.owner_email}
                  </a>
                ) : (
                  "連絡先なし"
                )}
                {" ・ "}登録 {formatDate(row.created_at)}
              </p>
              <p className="mt-1 text-sm tabular-nums text-gray-600">
                メンバー {row.member_count} ・ 作業員 {row.worker_count} ・ 現場 {row.site_count} ・ 予定（7日）{row.schedules_7d}
                ・ 写真（30日）{row.photos_30d} ・ 日報（30日）{row.reports_30d}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                最終利用 {formatDate(row.last_activity_at)} ・ 最終ログイン {formatDate(row.last_sign_in_at)}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                流入元 {source.label}
                {source.code ? <span className="ml-1 font-mono font-bold text-gray-900">コード {source.code}</span> : null}
              </p>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
