"use server";

import {
  briefChatSummary,
  briefDelayRisk,
  briefProjectSummary,
  briefWeeklySummary,
  proposeTaskTitles,
  type OpsBriefFacts,
} from "@kensapo/ai";
import { briefTodayInJapanese } from "@kensapo/decision-engine";
import { requireWorkspace } from "@/lib/authz-guard";
import { loadOpsBriefFacts } from "@/features/strategist/facts";
import { similarProjectsFor } from "@/features/similar/queries";
import { getAiService, getDecisionEngine } from "@/lib/engines";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StrategistState = {
  answer: string;
  proposedTasks: string[];
  intent: string;
  projectId: string;
};

const INTENTS = ["today", "project", "weekly", "chat", "risk", "similar", "tasks"] as const;
type Intent = (typeof INTENTS)[number];

function intentOf(value: string): Intent {
  return INTENTS.includes(value as Intent) ? (value as Intent) : "today";
}

async function polish(text: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return text;
  }
  try {
    return await getAiService().summarize(text, "report");
  } catch {
    return text;
  }
}

export async function askStrategistAction(
  _prev: StrategistState | null,
  formData: FormData,
): Promise<StrategistState> {
  const workspace = await requireWorkspace();
  const intent = intentOf(String(formData.get("intent") ?? "today"));
  let projectId = String(formData.get("projectId") ?? "");
  if (projectId) {
    const supabase = await createServerSupabaseClient();
    const owned = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("organization_id", workspace.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!owned.data) {
      projectId = "";
    }
  }
  const facts = await loadOpsBriefFacts(workspace.organizationId, projectId || null);
  const similar = projectId ? await similarProjectsFor(workspace.organizationId, projectId) : null;
  const similarLines =
    similar?.matches.map(
      (item) => `${item.name}（${item.reasons[0]?.label ?? "類似"} / 遅延${item.delayedCount}）`,
    ) ?? [];
  const withSimilar: OpsBriefFacts = { ...facts, similarLines };
  const proposedTasks = proposeTaskTitles(withSimilar);

  let raw = "";
  if (intent === "today") {
    const engine = getDecisionEngine();
    const signals = await engine.listForToday(workspace.organizationId, workspace.membershipId);
    raw = briefTodayInJapanese(
      signals.map((item) => ({ title: item.title, reason: String(item.evidence.reason ?? item.title) })),
    );
  } else if (intent === "project") {
    raw = briefProjectSummary(withSimilar);
  } else if (intent === "weekly") {
    raw = briefWeeklySummary(withSimilar);
  } else if (intent === "chat") {
    raw = briefChatSummary(facts.chatLines ?? []);
  } else if (intent === "risk") {
    raw = briefDelayRisk(withSimilar);
  } else if (intent === "similar") {
    raw =
      similarLines.length > 0
        ? [
            "【過去の類似現場】",
            ...similarLines,
            similar?.stats.avgDurationDays ? `平均工期 ${similar.stats.avgDurationDays}日` : "",
          ]
            .filter(Boolean)
            .join("\n")
        : "この会社内に比較できる現場がまだありません。";
  } else {
    raw = ["【Task提案（未作成）】人がチェックして追加してください。", ...proposedTasks.map((item) => `・${item}`)].join(
      "\n",
    );
  }

  const answer = `${await polish(raw)}\n\n（${workspace.organizationName} のデータのみ。AIは承認・削除・課金・メンバー変更をしません）`;
  return { answer, proposedTasks: intent === "tasks" ? proposedTasks : [], intent, projectId };
}
