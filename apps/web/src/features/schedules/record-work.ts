"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/client-errors";
import { notifyCompanyEvent } from "@/lib/push/client";
import { readPersonName } from "@/lib/person-name";

/**
 * 「作業を開始する」「作業を終了する」。今の時刻を記録し、会社のメンバーへ知らせる。
 * 誰が押したかは、共通ログインの端末では端末で選んだ名前を使う。
 */
export async function recordScheduleWork(
  scheduleId: string,
  action: "start" | "end",
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const supabase = createBrowserSupabaseClient();
    const { error } = await withTimeout(
      supabase.rpc("record_schedule_work", { p_schedule_id: scheduleId, p_action: action }),
      20000,
    );
    if (error) {
      if (/KENBEI_SCHEDULE_CLOSED/.test(error.message)) {
        return { ok: false, message: "この予定はもう終わっています。画面を読み込み直してください。" };
      }
      if (/KENBEI_SCHEDULE_NOT_STARTED/.test(error.message)) {
        return { ok: false, message: "先に「作業を開始する」を押してください。" };
      }
      return { ok: false, message: "保存できませんでした。通信を確認して、もう一度お試しください。" };
    }
  } catch {
    return { ok: false, message: "保存できませんでした。通信を確認して、もう一度お試しください。" };
  }
  void notifyCompanyEvent({
    event: action === "start" ? "work_started" : "work_ended",
    scheduleId,
    actorName: readPersonName() || undefined,
  });
  return { ok: true };
}
