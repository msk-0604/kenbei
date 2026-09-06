import type { OpsSignalInput, OpsSignalType } from "@kensapo/domain";

export type OpsFacts = {
  organizationId: string;
  overdueTasks: { id: string; projectId: string; title: string }[];
  delayedProcesses: { id: string; projectId: string; name: string }[];
  pendingConfirmCount: number;
  pendingConfirmProjectId: string | null;
  draftReports: { id: string; projectId: string }[];
  failedUploadCount: number;
  reviewTasks: { id: string; projectId: string; title: string }[];
};

export function buildOpsSignals(facts: OpsFacts): OpsSignalInput[] {
  const out: OpsSignalInput[] = [];
  const org = facts.organizationId;
  for (const task of facts.overdueTasks) {
    out.push(signal(org, task.projectId, "overdue_task", "high", "期限超過タスクがあります", task.title, task.id));
  }
  for (const process of facts.delayedProcesses) {
    out.push(
      signal(org, process.projectId, "delayed_process", "high", "工程が遅れています", process.name, process.id),
    );
  }
  if (facts.pendingConfirmCount > 0) {
    out.push(
      signal(
        org,
        facts.pendingConfirmProjectId,
        "pending_confirmation",
        "medium",
        "確認待ちがあります",
        `本日は${facts.pendingConfirmCount}件確認があります。`,
        "confirm",
      ),
    );
  }
  for (const report of facts.draftReports) {
    out.push(
      signal(org, report.projectId, "unconfirmed_report", "medium", "未確定の日報があります", "日報下書き", report.id),
    );
  }
  if (facts.failedUploadCount > 0) {
    out.push(
      signal(
        org,
        null,
        "failed_upload",
        "medium",
        "未同期の写真があります",
        `未同期写真が${facts.failedUploadCount}枚あります。`,
        "photos",
      ),
    );
  }
  for (const task of facts.reviewTasks) {
    out.push(
      signal(org, task.projectId, "overdue_approval", "medium", "承認待ちのタスクがあります", task.title, task.id),
    );
  }
  return out;
}

function signal(
  organizationId: string,
  projectId: string | null,
  type: OpsSignalType,
  severity: "low" | "medium" | "high",
  title: string,
  reason: string,
  refId: string,
): OpsSignalInput {
  return {
    organizationId,
    projectId,
    type,
    severity,
    title,
    reason,
    source: "rules",
    refId,
  };
}

export function briefTodayInJapanese(signals: { title: string; reason: string }[]): string {
  if (signals.length === 0) {
    return "本日、急ぎの注意事項はありません。写真と日報を閉じれば今日の事務は完了です。";
  }
  return ["今日何したらいいか、現場データから整理しました。", ...signals.slice(0, 8).map((item) => item.reason)].join(
    "\n",
  );
}
