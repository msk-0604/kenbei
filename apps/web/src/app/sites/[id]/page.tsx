import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionLink } from "@/components/ui/action-link";
import { OneOffBadge, StatusBadge } from "@/components/ui/badge";
import { WorkerNameList } from "@/components/ui/worker-name-list";
import { SeedProgressButton } from "@/features/sites/seed-progress-button";
import { ResendSiteNotice } from "@/features/sites/resend-site-notice";
import {
  countSitePhotos,
  getProgressItems,
  getProgressPresets,
  getSchedulesForProject,
  getSite,
} from "@/features/sites/queries";
import { uniqueWorkerNames } from "@/features/schedules/group";
import { isSiteAdmin, requireWorkspace } from "@/lib/authz-guard";
import { calcProgressSummary } from "@/lib/site-rules";
import { formatDate, todayISO } from "@/lib/site-dates";

export const dynamic = "force-dynamic";

export default async function SiteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const workspace = await requireWorkspace();
  const site = await getSite(id);
  if (!site) {
    notFound();
  }

  const [photoCount, siteSchedules, progressItems, presets] = await Promise.all([
    countSitePhotos(id),
    getSchedulesForProject(id).catch(() => []),
    getProgressItems(id).catch(() => []),
    getProgressPresets(),
  ]);

  const today = todayISO();
  const todayWorkers = uniqueWorkerNames(siteSchedules.filter((s) => s.schedule_date === today));
  const upcomingWorkers = uniqueWorkerNames(siteSchedules);
  const isAdmin = isSiteAdmin(workspace);
  const checklistSummary = progressItems.length > 0 ? calcProgressSummary(progressItems) : null;

  return (
    <>
      <PageHeader
        title={site.name}
        description="この現場の写真と作業工程を管理します"
        backHref="/sites"
        backLabel="現場一覧に戻る"
      />

      {query.notice === "retry" && isAdmin ? <ResendSiteNotice projectId={id} /> : null}

      <section className="mb-8 space-y-4">
        <ActionLink
          href={`/sites/${id}/progress`}
          description={checklistSummary ? `進捗 ${checklistSummary.percent}%` : "工事の進行をチェックする"}
        >
          作業工程を追加・変更する
        </ActionLink>
        <ActionLink href={`/sites/${id}/photos`} description={`登録済みの写真：${photoCount}枚`}>
          写真を追加する
        </ActionLink>
        <ActionLink href={`/sites/${id}/photos/gallery`} variant="secondary" description="複数選んで印刷できます">
          写真を選ぶ・印刷する
        </ActionLink>
        <ActionLink href={`/projects/${id}?tab=reports`} variant="secondary" description="日報・タスク・図面・チャット">
          日報と記録を見る
        </ActionLink>
      </section>

      <Card className="mb-8 !p-5">
        <h2 className="mb-4 text-lg font-bold text-gray-800">進捗状況</h2>
        {checklistSummary ? (
          <>
            <div className="mb-4 text-center">
              <p className="text-4xl font-bold text-navy-950">{checklistSummary.percent}%</p>
              <p className="mt-1 text-base text-gray-600">
                未完了 {checklistSummary.pending}件 / 全{checklistSummary.total}件
              </p>
              <div className="mt-3 h-4 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-navy-900" style={{ width: `${checklistSummary.percent}%` }} />
              </div>
            </div>
            <Link href={`/sites/${id}/progress`}>
              <Button fullWidth size="md">
                チェックリストを開く
              </Button>
            </Link>
          </>
        ) : (
          <>
            <p className="mb-4 text-base text-gray-600">紙の工事進行表をスマホでチェックできます。</p>
            {isAdmin ? <SeedProgressButton projectId={id} custom={presets.custom} /> : null}
          </>
        )}
      </Card>

      <Card className="mb-8">
        <div className="mb-4 flex items-center gap-2">
          {site.work_duration === "one_off" ? <OneOffBadge /> : null}
          <StatusBadge status={site.status} />
        </div>
        <dl className="space-y-5 text-base">
          <div>
            <dt className="font-bold text-gray-600">お客様名</dt>
            <dd className="mt-1 text-lg text-navy-950">{site.customer_name || "未入力"}</dd>
          </div>
          <div>
            <dt className="font-bold text-gray-600">住所</dt>
            <dd className="mt-1 text-lg font-bold text-navy-950">{site.address || "未入力"}</dd>
          </div>
          <div>
            <dt className="font-bold text-gray-600">担当者</dt>
            <dd className="mt-1 text-lg text-navy-950">{site.manager_name || "未設定"}</dd>
          </div>
          {site.prime_contractor_name ? (
            <div>
              <dt className="font-bold text-gray-600">元請け先</dt>
              <dd className="mt-1 text-lg text-navy-950">{site.prime_contractor_name}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-bold text-gray-600">工事内容</dt>
            <dd className="mt-1 text-lg text-navy-950">{site.work_type || "未設定"}</dd>
          </div>
          {site.caution ? (
            <div>
              <dt className="font-bold text-gray-600">注意事項</dt>
              <dd className="mt-1 whitespace-pre-wrap text-lg text-gray-800">{site.caution}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-bold text-gray-600">工期</dt>
            <dd className="mt-1 text-lg text-navy-950">
              {formatDate(site.start_date)} 〜 {formatDate(site.end_date)}
            </dd>
          </div>
          {site.completed_at ? (
            <div>
              <dt className="font-bold text-gray-600">完了した日</dt>
              <dd className="mt-1 text-lg text-navy-950">{formatDate(site.completed_at)}</dd>
            </div>
          ) : null}
          {site.memo ? (
            <div>
              <dt className="font-bold text-gray-600">メモ</dt>
              <dd className="mt-1 whitespace-pre-wrap text-lg leading-relaxed text-gray-800">{site.memo}</dd>
            </div>
          ) : null}
        </dl>
        {isAdmin ? (
          <div className="mt-6 border-t-2 border-gray-100 pt-5">
            <Link href={`/sites/${id}/edit`}>
              <Button variant="secondary" fullWidth size="md">
                現場の情報を変更する
              </Button>
            </Link>
          </div>
        ) : null}
      </Card>

      {isAdmin ? (
        <Card className="mb-8 !p-5">
          <h2 className="mb-3 text-xl font-bold text-navy-950">この現場の人員</h2>
          <div className="mb-5 rounded-2xl border-2 border-navy-200 bg-navy-900/5 px-4 py-4">
            <p className="mb-2 text-base font-bold text-navy-700">今日の作業員</p>
            <WorkerNameList names={todayWorkers} emptyLabel="今日の予定に作業員はいません" />
          </div>
          {upcomingWorkers.length > 0 ? (
            <div>
              <p className="mb-2 text-base font-bold text-gray-700">これから入る予定の作業員</p>
              <WorkerNameList names={upcomingWorkers} />
            </div>
          ) : null}
          <div className="mt-5">
            <Link href="/workers">
              <Button variant="secondary" fullWidth size="md">
                作業員の登録・一覧を見る
              </Button>
            </Link>
          </div>
        </Card>
      ) : null}

      <Card className="mb-8 !p-5">
        <h2 className="mb-4 text-xl font-bold text-navy-950">この現場の予定</h2>
        {siteSchedules.length > 0 ? (
          <ul className="space-y-3">
            {siteSchedules.map((s) => (
              <li key={s.id} className="rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-base font-bold text-navy-700">{formatDate(s.schedule_date)}</p>
                <p className="mt-1 text-xl font-bold text-navy-950">{s.worker_name || "作業員未割当"}</p>
                {s.work_content ? <p className="mt-1 text-base text-gray-600">{s.work_content}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-base text-gray-600">
            まだ予定が登録されていません。作業員を割り当てて予定を入れると、ここに名前が表示されます。
          </p>
        )}
        {isAdmin ? (
          <div className="mt-4">
            <Link href="/schedule">
              <Button variant={siteSchedules.length > 0 ? "secondary" : "primary"} fullWidth size="md">
                {siteSchedules.length > 0 ? "予定を追加・変更する" : "作業員の予定を登録する"}
              </Button>
            </Link>
          </div>
        ) : (
          <p className="text-base text-gray-600">予定の登録は管理者が行います。</p>
        )}
      </Card>
    </>
  );
}
