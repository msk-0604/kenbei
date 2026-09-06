import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { sendExpoPushToMember } from "@/lib/push";
import { listMemberProfileIdsWithPermission } from "@/lib/notifications";

export const runtime = "nodejs";

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function POST(request: Request) {
  const env = getPublicEnv();
  const jwt = bearerToken(request);
  if (!env || !jwt) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = createClient(env.url, env.anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(jwt);
  if (userError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    organizationId?: string;
    projectId?: string;
    kind?: string;
    title?: string;
    body?: string;
    href?: string;
    profileIds?: string[];
    permissionAudience?: string;
    extra?: Record<string, string>;
  } | null;
  const organizationId = payload?.organizationId ?? "";
  const title = payload?.title?.trim() ?? "";
  const kind = payload?.kind?.trim() ?? "";
  if (!payload || !organizationId || !title || !kind) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const membership = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("profile_id", user.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  if (!membership.data) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const ids = new Set((payload.profileIds ?? []).filter(Boolean));
  if (payload.permissionAudience) {
    const extra = await listMemberProfileIdsWithPermission(
      supabase,
      organizationId,
      payload.permissionAudience,
    );
    for (const id of extra) {
      ids.add(id);
    }
  }
  if (ids.size === 0) {
    return NextResponse.json({ ok: true, delivered: 0 });
  }

  const { data: members } = await supabase
    .from("memberships")
    .select("profile_id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("deleted_at", null)
    .in("profile_id", [...ids]);
  const allowed = new Set(
    ((members as { profile_id: string }[] | null) ?? []).map((row) => row.profile_id),
  );

  let delivered = 0;
  for (const profileId of ids) {
    if (!allowed.has(profileId)) {
      continue;
    }
    const { error } = await supabase.rpc("create_notification_for_member", {
      p_organization_id: organizationId,
      p_profile_id: profileId,
      p_project_id: payload.projectId ?? null,
      p_kind: kind,
      p_title: title,
      p_body: payload.body ?? null,
      p_href: payload.href ?? null,
    });
    if (error) {
      continue;
    }
    await sendExpoPushToMember({
      organizationId,
      profileId,
      title,
      body: payload.body,
      data: {
        kind,
        href: payload.href ?? "",
        projectId: payload.projectId ?? "",
        ...payload.extra,
      },
    });
    delivered += 1;
  }
  return NextResponse.json({ ok: true, delivered });
}
