import Link from "next/link";
import { parseSiteSearchQuery } from "@kensapo/domain";
import { AppShell } from "@/components/app-shell";
import { searchPhotos } from "@/features/photos/queries";
import { listProjectOptions } from "@/features/projects/queries";
import { tokyoTodayIso } from "@/lib/dates";
import { requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    projectId?: string;
    workType?: string;
    location?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requireWorkspace();
  const params = await searchParams;
  const parsed = parseSiteSearchQuery(params.q ?? "", tokyoTodayIso());
  const [photos, projects] = await Promise.all([
    searchPhotos({
      projectId: params.projectId,
      query: parsed.text || undefined,
      workType: params.workType,
      location: params.location || parsed.floor,
      from: params.from || parsed.from,
      to: params.to || parsed.to,
    }),
    listProjectOptions(),
  ]);

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">写真</h1>
        <Link href="/photos/upload" className="rounded-2xl bg-zinc-900 px-4 font-medium text-white">
          上げる
        </Link>
      </div>
      <form className="mt-6 flex flex-col gap-3 rounded-3xl bg-white p-4 ring-1 ring-zinc-100">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="3日前 2階 トイレ 配管"
          className="rounded-xl border border-zinc-200 px-4"
        />
        <select name="projectId" defaultValue={params.projectId ?? ""} className="rounded-xl border border-zinc-200 px-3">
          <option value="">すべての現場</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input name="workType" defaultValue={params.workType ?? ""} placeholder="工種" className="rounded-xl border border-zinc-200 px-4" />
          <input name="location" defaultValue={params.location ?? ""} placeholder="施工箇所" className="rounded-xl border border-zinc-200 px-4" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="date" name="from" defaultValue={params.from ?? ""} className="rounded-xl border border-zinc-200 px-3" />
          <input type="date" name="to" defaultValue={params.to ?? ""} className="rounded-xl border border-zinc-200 px-3" />
        </div>
        <button type="submit" className="rounded-2xl bg-zinc-900 font-medium text-white">
          探す
        </button>
      </form>
      <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {photos.map((photo) => (
          <li key={photo.id}>
            <Link href={`/photos/${photo.id}`} className="block overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-100">
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt="" className="h-36 w-full object-cover" />
              ) : (
                <div className="flex h-36 items-center justify-center text-sm text-zinc-400">画像なし</div>
              )}
              <p className="px-3 py-2 text-xs text-zinc-600">
                {photo.projectName} / {photo.workTypeKey ?? "未分類"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {photos.length === 0 ? <p className="mt-6 text-zinc-500">該当する写真はありません。</p> : null}
    </AppShell>
  );
}
