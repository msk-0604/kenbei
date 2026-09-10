import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";
import type { CookieToSet } from "@/lib/supabase/cookies";

function withRequestId(request: NextRequest): { request: NextRequest; requestId: string; requestHeaders: Headers } {
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  return { request, requestId, requestHeaders };
}

function attachRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function updateSession(request: NextRequest) {
  const { requestId, requestHeaders } = withRequestId(request);
  const env = getPublicEnv();
  if (!env) {
    return attachRequestId(NextResponse.next({ request: { headers: requestHeaders } }), requestId);
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/login" ||
    path === "/signup" ||
    path === "/join" ||
    path === "/forgot-password" ||
    path === "/reset-password" ||
    path.startsWith("/signup/") ||
    path.startsWith("/auth/") ||
    path.startsWith("/api/");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return attachRequestId(NextResponse.redirect(url), requestId);
  }

  if (user && (path === "/login" || path === "/signup")) {
    const next = request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      return attachRequestId(NextResponse.redirect(new URL(next, request.url)), requestId);
    }
    url.pathname = "/";
    url.search = "";
    return attachRequestId(NextResponse.redirect(url), requestId);
  }

  return attachRequestId(response, requestId);
}
