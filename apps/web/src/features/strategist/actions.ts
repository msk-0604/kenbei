"use server";

import { createProposedTasksAction } from "@/features/site-ops/actions";
import { createTodayReportDraftAction } from "@/features/reports/actions";
import { proposePhotoAssistAction } from "@/features/photos/actions";
import { consumeRateLimit } from "@/lib/rate-limit";
import { requireWorkspace } from "@/lib/authz-guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runStrategistAgent, type ChatMessage } from "@/features/strategist/agent-run";
import type { StrategistProposal } from "@/features/strategist/tools";

export type StrategistTurn = {
  role: "user" | "assistant";
  content: string;
  tools?: { name: string; ok: boolean }[];
};

export type StrategistChatState = {
  turns: StrategistTurn[];
  proposals: StrategistProposal[];
  error?: string;
};

const QUICK: Record<string, string> = {
  today: "今日何をすればいい？帰る前にやることも含めて。",
  project: "この現場の状況を要約して。遅れと未確認も。",
  weekly: "最近の日報から週次の要点を出して。",
  chat: "直近のチャットのやり取りをまとめて。",
  risk: "遅れている工程と遅延リスクを教えて。",
  similar: "似た現場を探して。",
  tasks: "明日のタスク案を出して。まだ作らないで。",
};

function parseHistory(raw: string): ChatMessage[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is ChatMessage => {
        return (
          Boolean(item) &&
          typeof item === "object" &&
          (item as ChatMessage).role !== undefined &&
          ((item as ChatMessage).role === "user" || (item as ChatMessage).role === "assistant") &&
          typeof (item as ChatMessage).content === "string"
        );
      })
      .slice(-6)
      .map((item) => ({ role: item.role, content: item.content.slice(0, 2000) }));
  } catch {
    return [];
  }
}

async function ownedProjectId(organizationId: string, projectId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function sendStrategistMessageAction(
  prev: StrategistChatState | null,
  formData: FormData,
): Promise<StrategistChatState> {
  const workspace = await requireWorkspace();
  if (!(await consumeRateLimit(`strategist:${workspace.userId}`, 20, 60_000))) {
    return {
      turns: prev?.turns ?? [],
      proposals: prev?.proposals ?? [],
      error: "少し時間をおいてからまた聞いてください。",
    };
  }
  const quick = String(formData.get("quick") ?? "");
  const typed = String(formData.get("message") ?? "").trim();
  const message = (QUICK[quick] ?? typed).trim();
  if (!message) {
    return { turns: prev?.turns ?? [], proposals: [], error: "内容を入力してください。" };
  }
  let projectId = String(formData.get("projectId") ?? "").trim();
  if (projectId) {
    projectId = (await ownedProjectId(workspace.organizationId, projectId)) ?? "";
  }
  const history = parseHistory(String(formData.get("history") ?? "[]"));
  const result = await runStrategistAgent({
    workspace,
    message,
    projectId: projectId || null,
    history,
  });
  const turns: StrategistTurn[] = [
    ...history.map((item): StrategistTurn => ({ role: item.role, content: item.content })),
    { role: "user" as const, content: message },
    { role: "assistant" as const, content: result.answer, tools: result.tools },
  ];
  return { turns: turns.slice(-12), proposals: result.proposals };
}

export async function confirmStrategistReportAction(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string } | null> {
  const workspace = await requireWorkspace();
  const projectId = await ownedProjectId(workspace.organizationId, String(formData.get("projectId") ?? ""));
  if (!projectId) {
    return { error: "現場を確認できません。" };
  }
  const result = await createTodayReportDraftAction(projectId);
  if (result && "error" in result && result.error) {
    return { error: result.error };
  }
  return { ok: "日報下書きを保存しました。確定は日報画面で人が行います。" };
}

export async function confirmStrategistTasksAction(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string } | null> {
  const result = await createProposedTasksAction(null, formData);
  if (result && "error" in result && result.error) {
    return { error: result.error };
  }
  if (result && "created" in result) {
    return { ok: `作成しました（${result.created}件）` };
  }
  return { error: "追加する提案を選んでください。" };
}

export async function confirmStrategistPhotosAction(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string } | null> {
  const ids = formData
    .getAll("photoIds")
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 12);
  if (ids.length === 0) {
    return { error: "対象写真がありません。" };
  }
  let ok = 0;
  for (const id of ids) {
    const result = await proposePhotoAssistAction(id);
    if (!result?.error) {
      ok += 1;
    }
  }
  if (ok === 0) {
    return { error: "分類案を保存できませんでした。" };
  }
  return { ok: `${ok}枚の分類案を保存しました。確定は写真確認画面で行います。` };
}
