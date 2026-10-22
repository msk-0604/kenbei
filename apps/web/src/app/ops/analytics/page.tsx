import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  biggestDrop,
  conversionByMonth,
  conversionBySource,
  featureUsage,
  funnel,
  percent,
  weeklyTrend,
} from "@/features/ops/analytics";
import { loadOpsAnalytics } from "@/features/ops/analytics-queries";
import { isPlatformAdminEmail } from "@/features/ops/org-health";
import { readServerEnv } from "@/lib/server-env";
import { getWorkspace } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "分析 | 運営 | KENBEI", robots: { index: false } };

function Bar({ rate, tone = "bg-sky-600" }: { rate: number; tone?: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-gray-100">
      <div className={`h-2 rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(1, rate)) * 100}%` }} />
    </div>
  );
}

function shortWeek(week: string): string {
  return `${Number(week.slice(5, 7))}/${Number(week.slice(8, 10))}〜`;
}

/** 運営の分析。どこで使うのをやめているか・週ごとの伸び・使われている機能・契約率を見て、次の打ち手を決める。 */
export default async function OpsAnalyticsPage() {
  const workspace = await getWorkspace();
  if (!workspace) {
    redirect("/login?next=/ops/analytics");
  }
  const adminEmails = readServerEnv("PLATFORM_ADMIN_EMAILS");
  if (!isPlatformAdminEmail(workspace.email, adminEmails)) {
    notFound();
  }
  const data = await loadOpsAnalytics(adminEmails);
  if (!data.ok) {
    return (
      <p className="p-6" role="alert">
        {data.reason === "no_service_role"
          ? "SUPABASE_SERVICE_ROLE_KEY が未設定です。"
          : "集計を読めませんでした（DB の移行 20261021100000_platform_usage_analytics.sql が未適用かもしれません）。"}
      </p>
    );
  }
  const now = new Date();
  const steps = funnel(data.orgs);
  const drop = biggestDrop(steps);
  const weeks = weeklyTrend(data.orgs, data.events, now, 8, data.visits);
  const usage = featureUsage(data.orgs, data.events, now, 30);
  const byMonth = conversionByMonth(data.orgs);
  const bySource = conversionBySource(data.orgs);
  const last4 = weeks.slice(-4);
  const visits4 = last4.reduce((sum, w) => sum + w.visits, 0);
  const signups4 = last4.reduce((sum, w) => sum + w.signups, 0);
  const thisWeek = weeks[weeks.length - 1];
  const lastWeek = weeks[weeks.length - 2];
  const paid = steps[steps.length - 1]?.count ?? 0;
  const card = "rounded-2xl bg-white p-4 ring-1 ring-gray-200";
  const th = "px-2 py-2 text-left font-medium text-gray-600";
  const td = "px-2 py-2 tabular-nums";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-gray-600">
            <Link href="/ops" className="underline">
              運営
            </Link>
          </p>
          <h1 className="text-3xl font-bold text-gray-950">分析</h1>
          <p className="mt-1 text-sm text-gray-600">
            お客さんがどこまで使い始め、どこで止まっているか。毎週月曜に見て、打ち手を1つ決めてください。
            {data.excluded > 0 ? `（運営の会社 ${data.excluded}社は数えていません）` : ""}
          </p>
        </div>
        <a href="/ops/analytics/csv" className="rounded-full bg-gray-950 px-4 py-2 text-sm font-bold text-white">
          会社ごとの一覧（CSV）
        </a>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "登録した会社", value: `${data.orgs.length}社`, note: "" },
          {
            label: "今週使った会社",
            value: `${thisWeek?.activeOrgs ?? 0}社`,
            note: lastWeek ? `先週 ${lastWeek.activeOrgs}社` : "",
          },
          { label: "訪問→登録（4週）", value: visits4 > 0 ? percent(signups4 / visits4) : "—", note: `訪問 ${visits4}人・登録 ${signups4}社` },
          { label: "登録→契約", value: percent(data.orgs.length ? paid / data.orgs.length : 0), note: `契約 ${paid}社` },
        ].map((item) => (
          <div key={item.label} className={card}>
            <dt className="text-sm text-gray-600">{item.label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-950">{item.value}</dd>
            {item.note ? <dd className="text-xs text-gray-500">{item.note}</dd> : null}
          </div>
        ))}
      </dl>

      {drop ? (
        <section className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <h2 className="text-base font-bold text-amber-950">次に手を打つところ：「{drop.label}」</h2>
          <p className="mt-1 text-sm text-amber-900">
            ここで止まる会社がいちばん多いです。打ち手の例：{drop.hint}。止まっている会社は「
            <Link href="/ops?filter=follow" className="underline">
              連絡する
            </Link>
            」に出ています。
          </p>
        </section>
      ) : null}

      <section className={card}>
        <h2 className="text-lg font-bold text-gray-950">使い始めの流れ（ここまで来た会社）</h2>
        <p className="text-sm text-gray-600">登録してから、作業員がスマホで使い、日報を出し、契約するまで。前の段からの割合が低いところが止まりどころです。</p>
        <ol className="mt-3 space-y-3">
          {steps.map((step) => (
            <li key={step.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-gray-900">{step.label}</span>
                <span className="tabular-nums text-gray-700">
                  {step.count}社 <span className="text-gray-500">（前の段から {percent(step.rateFromPrev)}）</span>
                </span>
              </div>
              <Bar rate={step.rateFromTop} />
            </li>
          ))}
        </ol>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold text-gray-950">週ごとの推移（月曜〜日曜）</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className={th}>週</th>
                <th className={th}>訪問</th>
                <th className={th}>登録</th>
                <th className={th}>使った会社</th>
                <th className={th}>予定</th>
                <th className={th}>作業開始</th>
                <th className={th}>写真</th>
                <th className={th}>日報</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {weeks.map((w) => (
                <tr key={w.week}>
                  <td className={`${td} whitespace-nowrap`}>{shortWeek(w.week)}</td>
                  <td className={td}>{w.visits}</td>
                  <td className={td}>{w.signups}</td>
                  <td className={`${td} font-bold`}>{w.activeOrgs}</td>
                  <td className={td}>{w.schedules}</td>
                  <td className={td}>{w.workStarts}</td>
                  <td className={td}>{w.photos}</td>
                  <td className={td}>{w.reports}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">訪問はトップページなどに来た人の数（同じ人は1日1回）。使った会社は、その週に予定・作業開始・写真・日報・タスク・チャットのどれかがあった会社。</p>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold text-gray-950">機能ごとの利用（この30日）</h2>
        <p className="text-sm text-gray-600">使っている会社の割合。低い機能は、案内が届いていないか、要らない機能です。</p>
        <ul className="mt-3 space-y-3">
          {usage.map((row) => (
            <li key={row.kind}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-gray-900">{row.label}</span>
                <span className="tabular-nums text-gray-700">
                  {row.orgs}社（{percent(row.rate)}）・{row.count.toLocaleString("ja-JP")}件
                </span>
              </div>
              <Bar rate={row.rate} tone="bg-emerald-600" />
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { title: "登録した月ごとの契約率", rows: byMonth, keyLabel: "登録した月" },
          { title: "流入元ごとの契約率", rows: bySource, keyLabel: "流入元" },
        ].map((table) => (
          <section key={table.title} className={card}>
            <h2 className="text-lg font-bold text-gray-950">{table.title}</h2>
            {table.rows.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">まだありません。</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={th}>{table.keyLabel}</th>
                    <th className={th}>登録</th>
                    <th className={th}>契約</th>
                    <th className={th}>契約率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {table.rows.map((row) => (
                    <tr key={row.key}>
                      <td className={`${td} break-words`}>{row.key}</td>
                      <td className={td}>{row.signups}</td>
                      <td className={td}>{row.paid}</td>
                      <td className={`${td} font-bold`}>{percent(row.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
