import { NextResponse } from "next/server";
import { getWorkspace, hasOrganization } from "@/lib/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getVapidPublicKey, isWebPushConfigured } from "@/lib/push/web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ブラウザ（ホーム画面に追加したアプリ）の通知の受け取り登録 */
export async function GET() {
  return NextResponse.json({ configured: isWebPushConfigured(), publicKey: getVapidPublicKey() });
}

export async function POST(request: Request) {
  const workspace = await getWorkspace();
  if (!workspace || !hasOrganization(workspace)) {
    return NextResponse.json({ error: "ログインし直してください" }, { status: 401 });
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "通知のサーバー設定がまだ完了していません" }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  } | null;
  const endpoint = body?.endpoint?.trim();
  const p256dh = body?.keys?.p256dh?.trim();
  const auth = body?.keys?.auth?.trim();
  if (!endpoint || !endpoint.startsWith("https://") || endpoint.length > 1000 || !p256dh || !auth) {
    return NextResponse.json({ error: "登録内容が正しくありません" }, { status: 400 });
  }
  const supabase = await createServerSupabaseClient();
  // 同じ端末（endpoint）が前にログインしていた人の分で残っていたら消して、いまの人に付け替える。
  // endpoint はこのブラウザだけが知っている値なので、持っている人が付け替えてよい。
  const admin = createAdminSupabaseClient();
  if (admin) {
    await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  } else {
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("profile_id", workspace.userId);
  }
  const { error } = await supabase.from("push_subscriptions").insert({
    organization_id: workspace.organizationId,
    profile_id: workspace.userId,
    endpoint,
    p256dh,
    auth,
    user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    last_used_at: new Date().toISOString(),
  });
  if (error) {
    return NextResponse.json({ error: "登録に失敗しました。もう一度お試しください。" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const workspace = await getWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "ログインし直してください" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("push_subscriptions").delete().eq("profile_id", workspace.userId);
  if (body.endpoint?.trim()) {
    query = query.eq("endpoint", body.endpoint.trim());
  }
  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: "解除に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
