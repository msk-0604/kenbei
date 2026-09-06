import { DOCUMENT_KIND_LABELS } from "@kensapo/domain";
import { AppShell } from "@/components/app-shell";
import { KnowledgeUploadForm } from "@/features/knowledge/upload-form";
import { listCompanyDocuments, searchCompanyKnowledge } from "@/features/knowledge/queries";
import { can, requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const workspace = await requireWorkspace();
  const params = await searchParams;
  const query = params.q ?? "";
  const [docs, hits] = await Promise.all([
    listCompanyDocuments(),
    query ? searchCompanyKnowledge(query) : Promise.resolve([]),
  ]);
  const canWrite =
    can(workspace, "knowledge.write") || can(workspace, "import.manage") || can(workspace, "project.update");
  const canRead = can(workspace, "knowledge.read") || canWrite;

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">資料</h1>
      <p className="mt-2 text-base text-zinc-600">この会社のルールと資料だけが見えます。</p>
      {canRead ? (
        <form className="mt-6 flex flex-col gap-3">
          <input
            name="q"
            defaultValue={query}
            placeholder="高所作業するときの社内ルールは？"
            className="rounded-xl border border-zinc-200 px-4"
          />
          <button type="submit" className="rounded-2xl bg-zinc-900 font-medium text-white">
            社内資料を探す
          </button>
        </form>
      ) : (
        <p className="mt-6 text-zinc-500">資料を見る権限がありません。</p>
      )}
      {query ? (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-medium">検索結果</h2>
          <ul className="flex flex-col gap-2">
            {hits.map((hit) => (
              <li key={hit.id} className="rounded-2xl bg-white p-4 ring-1 ring-zinc-100">
                <p className="font-medium">{hit.title}</p>
                <p className="mt-1 text-sm text-zinc-500">{hit.snippet}</p>
              </li>
            ))}
          </ul>
          {hits.length === 0 ? <p className="text-sm text-zinc-500">該当する資料はありません。</p> : null}
        </section>
      ) : null}
      {canWrite ? (
        <section className="mt-8 rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
          <h2 className="mb-3 text-base font-medium">資料を登録</h2>
          <KnowledgeUploadForm />
        </section>
      ) : null}
      <ul className="mt-8 flex flex-col gap-3">
        {docs.map((doc) => (
          <li key={doc.id} className="rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
            <p className="font-medium">{doc.title}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {DOCUMENT_KIND_LABELS[doc.kind as keyof typeof DOCUMENT_KIND_LABELS] ?? doc.kind}
            </p>
            {doc.url ? (
              <a href={doc.url} className="mt-3 inline-flex text-sm underline">
                開く
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      {docs.length === 0 && canRead ? <p className="mt-6 text-zinc-500">会社資料はまだありません。</p> : null}
    </AppShell>
  );
}
