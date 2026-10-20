import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listCompletedSites } from "@/features/sites/queries";
import { requireSiteAdmin } from "@/lib/authz-guard";
import { formatShortDate, isIsoDate } from "@/lib/site-dates";

export const dynamic = "force-dynamic";

/** 完了した現場だけ。完了日（日本時間）で絞り込み、新しい順。 */
export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireSiteAdmin();
  const params = await searchParams;
  const from = isIsoDate(params.from) ? params.from : undefined;
  const to = isIsoDate(params.to) ? params.to : undefined;
  const sites = await listCompletedSites({ from, to }).catch(() => []);
  const filtered = Boolean(from || to);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/kanri"
          className="tap-press mb-5 flex min-h-[4rem] w-full items-center justify-center rounded-2xl border-2 border-gray-300 bg-white px-5 text-xl font-bold text-navy-900"
        >
          ← 管理画面に戻る
        </Link>
        <h1 className="text-3xl font-bold text-gray-950">完了した現場の保存</h1>
        <p className="mt-2 text-lg leading-relaxed text-gray-700">
          完了した現場だけを一覧にしています。完了した日で絞り込めます。
        </p>
      </header>

      <Card>
        <form className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="完了日（から）" id="archive-from" type="date" name="from" defaultValue={from ?? ""} />
            <Input label="完了日（まで）" id="archive-to" type="date" name="to" defaultValue={to ?? ""} />
          </div>
          <Button type="submit" fullWidth>
            絞り込む
          </Button>
          {filtered ? (
            <Link href="/kanri/archive" className="block text-center text-lg font-bold text-gray-600">
              絞り込みを解除する
            </Link>
          ) : null}
        </form>
      </Card>

      {sites.length === 0 ? (
        <EmptyState
          title="完了した現場がありません"
          description={filtered ? "この期間に完了した現場はありません。" : "現場が完了になると、ここに記録されます。"}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border-2 border-gray-200 bg-white">
          <div className="grid grid-cols-[5rem_1fr_6rem] gap-2 border-b-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-600">
            <span>完了日</span>
            <span>現場名</span>
            <span>お客様名</span>
          </div>
          <ul>
            {sites.map((site) => (
              <li key={site.id} className="border-b border-gray-100 last:border-0">
                <Link
                  href={`/sites/${site.id}`}
                  className="tap-press grid grid-cols-[5rem_1fr_6rem] items-center gap-2 px-3 py-3 active:bg-gray-50"
                >
                  <span className="text-sm text-gray-700">
                    {site.completed_at ? formatShortDate(site.completed_at) : "不明"}
                  </span>
                  <span className="truncate text-lg font-bold text-gray-950">{site.name}</span>
                  <span className="truncate text-base text-gray-700">{site.customer_name || "—"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
