import Link from "next/link";
import { Calendar, LayoutDashboard, Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HintBox } from "@/components/ui/hint-box";
import { SiteBrowser } from "@/features/sites/site-browser";
import { getSchedulesForDate, listSites } from "@/features/sites/queries";
import { workerNamesByProject } from "@/features/schedules/group";
import { isSiteAdmin, requireWorkspace } from "@/lib/authz-guard";
import { todayISO } from "@/lib/site-dates";

export const dynamic = "force-dynamic";

const INTENT_MESSAGES: Record<string, { title: string; body: string }> = {
  photo: {
    title: "写真を追加する現場を選んでください",
    body: "下の一覧から、写真を撮りたい現場の名前をタップしてください。",
  },
  process: {
    title: "工程を変更する現場を選んでください",
    body: "下の一覧から、工程を変更したい現場の名前をタップしてください。",
  },
};

export default async function SitesPage({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  const { intent } = await searchParams;
  const workspace = await requireWorkspace();
  const [sites, todaySchedules] = await Promise.all([
    listSites(),
    getSchedulesForDate(todayISO()).catch(() => []),
  ]);
  const isAdmin = isSiteAdmin(workspace);
  const todayWorkers = workerNamesByProject(todaySchedules);
  const intentMessage = intent ? INTENT_MESSAGES[intent] : null;

  return (
    <>
      <PageHeader
        title="現場一覧"
        description={sites.length > 0 ? `${sites.length}か所の現場が登録されています` : "工事の現場をここで管理します"}
        action={
          isAdmin ? (
            <div className="flex flex-col gap-3">
              <Link href="/sites/new">
                <Button fullWidth size="md">
                  新しい現場を登録する
                </Button>
              </Link>
              <Link
                href="/kanri/schedules"
                className="tap-press flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-gray-300 bg-white px-4 text-base font-bold text-gray-700"
              >
                <Calendar className="h-5 w-5" aria-hidden />
                予定を見る・変更する
              </Link>
              <Link
                href="/settings"
                className="tap-press flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-gray-300 bg-white px-4 text-base font-bold text-gray-700"
              >
                <Settings className="h-5 w-5" aria-hidden />
                設定（合言葉の変更など）
              </Link>
              <Link
                href="/kanri"
                className="tap-press flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-gray-300 bg-white px-4 text-base font-bold text-gray-700"
              >
                <LayoutDashboard className="h-5 w-5" aria-hidden />
                管理画面を開く
              </Link>
            </div>
          ) : undefined
        }
      />

      {intentMessage ? (
        <HintBox>
          <p className="font-bold">{intentMessage.title}</p>
          <p className="mt-1">{intentMessage.body}</p>
        </HintBox>
      ) : null}
      {!isAdmin ? <HintBox>この画面は作業者用です。現場の新規登録や編集は管理者だけができます。</HintBox> : null}

      {sites.length === 0 ? (
        <EmptyState
          title="現場がまだありません"
          description="工事の現場を登録すると、写真の管理や作業工程の記録ができるようになります。"
          steps={[
            "「新しい現場を登録する」ボタンを押す",
            "現場の名前・住所・担当者などを入力する",
            "登録した現場から、写真や作業工程を記録する",
          ]}
          action={
            isAdmin ? (
              <Link href="/sites/new">
                <Button fullWidth>新しい現場を登録する</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <SiteBrowser
          sites={sites.map((site) => ({
            id: site.id,
            name: site.name,
            address: site.address,
            primeContractorName: site.prime_contractor_name,
            customerName: site.customer_name ?? site.manager_name,
            status: site.status,
            workDuration: site.work_duration,
            today: (todayWorkers[site.id] ?? []).length > 0,
          }))}
          linkTo={intent === "process" ? "progress" : "detail"}
        />
      )}
    </>
  );
}
