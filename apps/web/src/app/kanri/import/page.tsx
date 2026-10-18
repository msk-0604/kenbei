import Link from "next/link";
import { CsvImportCard } from "@/features/import/csv-import-card";
import { requireSiteAdmin } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

/** Excel の一覧から作業員・現場をまとめて登録する */
export default async function KanriImportPage() {
  await requireSiteAdmin();
  return (
    <div className="space-y-5">
      <header>
        <p className="text-base text-gray-600">
          <Link href="/kanri" className="underline">
            管理
          </Link>
        </p>
        <h1 className="mt-1 text-3xl font-bold text-gray-950">Excel から取り込む</h1>
        <p className="mt-2 text-lg text-gray-700">
          今お使いの作業員名簿や現場一覧を、まとめて登録できます。1件ずつ入れる必要はありません。
        </p>
      </header>
      <CsvImportCard kind="workers" />
      <CsvImportCard kind="sites" />
      <p className="text-gray-600">
        Excel での保存方法：「ファイル」→「名前を付けて保存」→ ファイルの種類で「CSV（コンマ区切り）」を選びます。
      </p>
    </div>
  );
}
