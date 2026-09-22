import { cookies } from "next/headers";
import { isKenbeiProductionRuntime } from "@/lib/app-url";
import { rememberJoinNext } from "@/lib/invite-next-path";

export const JOIN_NEXT_COOKIE = "kb_join_next";

export async function writeJoinNextCookie(next: string): Promise<void> {
  const value = rememberJoinNext(next);
  if (!value) {
    return;
  }
  const jar = await cookies();
  jar.set(JOIN_NEXT_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    secure: isKenbeiProductionRuntime(),
  });
}

export async function readJoinNextCookie(): Promise<string> {
  const jar = await cookies();
  return rememberJoinNext(jar.get(JOIN_NEXT_COOKIE)?.value ?? "");
}
