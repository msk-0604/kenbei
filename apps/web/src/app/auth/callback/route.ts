import { NextResponse } from "next/server";
import { inviteTokenFromNextPath } from "@kensapo/domain";
import { acceptInviteForCurrentUser } from "@/features/settings/accept-invite";
import { isKenbeiProductionRuntime } from "@/lib/app-url";
import { getAppUrl } from "@/lib/env";
import { resolveAuthNext } from "@/lib/invite-next-path";
import { readJoinNextCookie } from "@/lib/invite-next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const path = resolveAuthNext(url.searchParams.get("next"), await readJoinNextCookie()) || "/";
  const origin = isKenbeiProductionRuntime() ? getAppUrl() : url.origin;
  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // 登録した端末と別の端末（PC で登録してスマホでメールを開いたなど）では、確認は済んでもログインまではできない。
      const login = new URL("/login", origin);
      login.searchParams.set("confirmed", "1");
      if (path !== "/") {
        login.searchParams.set("next", path);
      }
      return NextResponse.redirect(login);
    }
  }
  const token = inviteTokenFromNextPath(path);
  if (token) {
    const accepted = await acceptInviteForCurrentUser(token);
    if ("joined" in accepted) {
      return NextResponse.redirect(new URL("/", origin));
    }
  }
  return NextResponse.redirect(new URL(path, origin));
}
