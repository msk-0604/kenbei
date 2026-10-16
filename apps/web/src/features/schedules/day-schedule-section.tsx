"use client";

import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * カレンダー下の「その日の予定一覧（追加・編集・削除）」は常に表示せず、
 * ボタンを押したときだけ開く。モーダルの「この日の予定を見る・変更する」
 * リンクから ?open=1 付きで来た場合は、最初から開いた状態にする。
 */
export function DayScheduleSection({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(searchParams.get("open") === "1");

  return (
    <section className="mb-6">
      <Button
        type="button"
        variant="secondary"
        fullWidth
        size="md"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "予定一覧を閉じる" : "予定を見る・変更する"}
      </Button>
      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
