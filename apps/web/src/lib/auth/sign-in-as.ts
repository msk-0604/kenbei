import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * サーバーで本人確認が済んだ利用者（合言葉・顔認証）に、通常のログインセッションを作る。
 * 一度きりのログインリンクをサーバーの中だけで発行して、その場で使う（メールは送らない）。
 */
export async function signInAsUser(admin: SupabaseClient, profileId: string): Promise<boolean> {
  const userResult = await admin.auth.admin.getUserById(profileId);
  const email = userResult.data?.user?.email;
  if (userResult.error || !email) {
    return false;
  }
  const generated = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = generated.data?.properties?.hashed_token;
  if (generated.error || !tokenHash) {
    return false;
  }
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  return !error;
}
