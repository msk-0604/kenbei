import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HintBox } from "@/components/ui/hint-box";
import { listWorkers } from "@/features/sites/queries";
import { can, requireSiteAdmin } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function WorkersPage() {
  const workspace = await requireSiteAdmin();
  const workers = await listWorkers();
  const canInvite = can(workspace, "member.manage");

  return (
    <>
      <PageHeader
        title="作業員一覧"
        description={
          workers.length > 0 ? `${workers.length}人の作業員が登録されています` : "作業員を登録して、予定管理に使えます"
        }
        backHref="/kanri"
        backLabel="管理に戻る"
        action={
          <Link href="/workers/new">
            <Button fullWidth size="md">
              作業員を登録する
            </Button>
          </Link>
        }
      />

      <HintBox>
        <p className="font-bold">作業員のログインは2通りです</p>
        <p className="mt-1">・会社の合言葉で入る（設定画面で合言葉を決めます）</p>
        <p>・自分のメールアドレスで入る（メンバーとして招待します）</p>
        {canInvite ? (
          <Link href="/settings/members" className="mt-2 inline-block font-bold underline">
            メンバーを招待する →
          </Link>
        ) : null}
      </HintBox>

      {workers.length === 0 ? (
        <EmptyState
          title="作業員がまだいません"
          description="名前を登録すると、予定に割り当てられるようになります。"
          action={
            <Link href="/workers/new">
              <Button fullWidth>作業員を登録する</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {workers.map((worker) => (
            <li key={worker.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-bold text-navy-950">{worker.name}</h3>
                  {worker.status === "inactive" ? (
                    <span className="rounded-full border-2 border-gray-300 px-3 py-0.5 text-base font-bold text-gray-600">
                      休止中
                    </span>
                  ) : null}
                </div>
                {worker.phone ? <p className="mt-2 text-base text-gray-600">電話：{worker.phone}</p> : null}
                {worker.membership_id ? (
                  <p className="mt-1 text-base text-gray-600">アカウントと紐づけ済み</p>
                ) : null}
                <Link
                  href={`/workers/${worker.id}/edit`}
                  className="tap-press mt-4 flex min-h-[3.5rem] items-center justify-center rounded-2xl border-2 border-gray-300 bg-white text-lg font-bold text-navy-900 hover:bg-gray-50"
                >
                  この作業員を変更する
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
