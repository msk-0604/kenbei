import { NoticeInbox, type NoticeItem } from "@/features/notices/notice-inbox";
import { NotificationSettings } from "@/features/settings/notification-settings";
import { requireWorkspace } from "@/lib/authz-guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NoticesPage() {
  const workspace = await requireWorkspace();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, href, read_at, created_at")
    .eq("organization_id", workspace.organizationId)
    .eq("profile_id", workspace.userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  const items = (data as NoticeItem[] | null) ?? [];
  const unread = items.filter((item) => !item.read_at).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-950">お知らせ</h1>
        <p className="mt-2 text-lg text-gray-700">{error ? "読み込めませんでした" : `未読 ${unread}件`}</p>
      </header>
      <NoticeInbox initialItems={items} tableReady={!error} />
      <section className="rounded-2xl border-2 border-gray-200 bg-white p-4">
        <h2 className="text-xl font-bold text-gray-950">ホーム画面への追加</h2>
        <p className="mt-2 text-lg leading-relaxed text-gray-800">
          iPhoneでは、共有ボタンから「ホーム画面に追加」を押し、追加したアイコンから開いてください。
        </p>
      </section>
      <NotificationSettings />
      <p className="text-lg text-gray-600">
        スマホを閉じているときの通知は、届かないことがあります。届かなくても、このお知らせには残ります。
      </p>
    </div>
  );
}
