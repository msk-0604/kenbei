"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { clearPersonName, readPersonName } from "@/lib/person-name";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

/** 共通ログインの端末で、この端末の名前を選び直す */
export function ChangeDeviceNameButton() {
  const [name, setName] = useState("");
  useEffect(() => {
    setName(readPersonName());
  }, []);
  return (
    <Button
      type="button"
      variant="secondary"
      fullWidth
      onClick={() => {
        clearPersonName();
        window.location.assign("/today");
      }}
    >
      {name ? `名前を選び直す（いまは「${name}」）` : "名前を選ぶ"}
    </Button>
  );
}

export function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <Button type="button" variant="secondary" fullWidth onClick={() => void handleLogout()}>
      ログアウトする
    </Button>
  );
}
