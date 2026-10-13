"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { seedProgressItemsAction } from "@/features/sites/actions";

export function SeedProgressButton({ projectId, custom }: { projectId: string; custom: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSeed() {
    setLoading(true);
    setMessage("");
    const result = await seedProgressItemsAction(projectId).catch(() => ({
      ok: false as const,
      error: "作成に失敗しました。もう一度お試しください。",
    }));
    setLoading(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage(result.created > 0 ? `${result.created}件のチェック項目を作成しました。` : "すでにチェック項目があります。");
    router.refresh();
  }

  return (
    <div>
      <Button type="button" fullWidth loading={loading} onClick={() => void handleSeed()}>
        {custom ? "会社のチェック項目を作成する" : "標準チェック項目を作成する"}
      </Button>
      {message ? <p className="mt-3 text-base text-gray-600">{message}</p> : null}
    </div>
  );
}
