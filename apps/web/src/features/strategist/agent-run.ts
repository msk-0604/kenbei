import "server-only";

import {
  OPENAI_STRATEGIST_TOOLS,
  isAllowedStrategistTool,
  resolveAiModel,
  routeStrategistHeuristically,
  strategistSystemPrompt,
} from "@kensapo/ai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/session";
import { runStrategistTool, type StrategistProposal, type ToolRunResult } from "@/features/strategist/tools";

const MAX_LOOPS = 4;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type StrategistAgentResult = {
  answer: string;
  tools: { name: string; ok: boolean }[];
  proposals: StrategistProposal[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  usedLlm: boolean;
};

type OpenAiToolCall = {
  id: string;
  function?: { name?: string; arguments?: string };
};

function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) {
    return {};
  }
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function logEvent(
  organizationId: string,
  projectId: string | null,
  requested: string,
  tool: string,
  success: boolean,
  model: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.rpc("log_ai_strategist_event", {
      p_organization_id: organizationId,
      p_project_id: projectId,
      p_requested_action: requested.slice(0, 500),
      p_tool: tool.slice(0, 80),
      p_success: success,
      p_model: model,
      p_input_tokens: usage?.prompt_tokens ?? 0,
      p_output_tokens: usage?.completion_tokens ?? 0,
      p_total_tokens: usage?.total_tokens ?? 0,
    });
  } catch {
    // Audit must never crash the user path.
  }
}

async function runHeuristicAgent(
  workspace: Workspace,
  message: string,
  projectId: string | null,
): Promise<StrategistAgentResult> {
  const route = routeStrategistHeuristically(message);
  const proposals: StrategistProposal[] = [];
  const tools: { name: string; ok: boolean }[] = [];
  const chunks: string[] = [];
  for (const name of route.tools) {
    const result = await runStrategistTool(workspace, name, { projectId }, projectId);
    tools.push({ name, ok: result.ok });
    if (result.proposal) {
      proposals.push(result.proposal);
    }
    chunks.push(`${name}: ${result.json}`);
    await logEvent(workspace.organizationId, projectId, message, name, result.ok, "heuristic");
  }
  const answer = [
    "AIキーがないか応答できないため、社内データからの事実だけをまとめました。",
    ...chunks.map((line) => line.slice(0, 800)),
    proposals.length > 0 ? "下の確認カードで実行できます。AIはまだ書き込んでいません。" : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    answer,
    tools,
    proposals,
    model: "heuristic",
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    usedLlm: false,
  };
}

export async function runStrategistAgent(input: {
  workspace: Workspace;
  message: string;
  projectId: string | null;
  history: ChatMessage[];
}): Promise<StrategistAgentResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return runHeuristicAgent(input.workspace, input.message, input.projectId);
  }

  const model = resolveAiModel("default", {
    KENBEI_AI_MODEL_LIGHT: process.env.KENBEI_AI_MODEL_LIGHT,
    KENBEI_AI_MODEL_DEFAULT: process.env.KENBEI_AI_MODEL_DEFAULT,
    KENBEI_AI_MODEL_REASONING: process.env.KENBEI_AI_MODEL_REASONING,
  });
  const proposals: StrategistProposal[] = [];
  const tools: { name: string; ok: boolean }[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  type Wire = {
    role: "system" | "user" | "assistant" | "tool";
    content?: string;
    tool_calls?: OpenAiToolCall[];
    tool_call_id?: string;
  };
  const messages: Wire[] = [
    { role: "system", content: strategistSystemPrompt() },
    ...input.history.slice(-6).map((item) => ({ role: item.role, content: item.content.slice(0, 2000) })),
    { role: "user", content: input.message.slice(0, 4000) },
  ];

  try {
    for (let loop = 0; loop < MAX_LOOPS; loop += 1) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          tools: OPENAI_STRATEGIST_TOOLS,
          messages,
        }),
      });
      if (!response.ok) {
        await logEvent(input.workspace.organizationId, input.projectId, input.message, "llm", false, model);
        const fallback = await runHeuristicAgent(input.workspace, input.message, input.projectId);
        return { ...fallback, answer: `AIの応答に失敗したため、読み取り結果のみ表示します。\n\n${fallback.answer}` };
      }
      const json = (await response.json()) as {
        choices?: { message?: { content?: string | null; tool_calls?: OpenAiToolCall[] } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      inputTokens += json.usage?.prompt_tokens ?? 0;
      outputTokens += json.usage?.completion_tokens ?? 0;
      totalTokens += json.usage?.total_tokens ?? 0;
      const message = json.choices?.[0]?.message;
      const calls = message?.tool_calls ?? [];
      if (calls.length === 0) {
        const answer =
          message?.content?.trim() ||
          "事実を確認できませんでした。現場を選ぶか、別の聞き方をしてください。";
        await logEvent(
          input.workspace.organizationId,
          input.projectId,
          input.message,
          tools.map((item) => item.name).join(",") || "none",
          true,
          model,
          json.usage,
        );
        return {
          answer,
          tools,
          proposals,
          model,
          inputTokens,
          outputTokens,
          totalTokens,
          usedLlm: true,
        };
      }
      messages.push({
        role: "assistant",
        content: message?.content ?? "",
        tool_calls: calls,
      });
      for (const call of calls.slice(0, 6)) {
        const name = call.function?.name ?? "";
        if (!isAllowedStrategistTool(name)) {
          tools.push({ name: name || "blocked", ok: false });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: "この操作は許可されていません。" }),
          });
          await logEvent(input.workspace.organizationId, input.projectId, input.message, name || "blocked", false, model);
          continue;
        }
        const result: ToolRunResult = await runStrategistTool(
          input.workspace,
          name,
          parseArgs(call.function?.arguments),
          input.projectId,
        );
        tools.push({ name, ok: result.ok });
        if (result.proposal) {
          proposals.push(result.proposal);
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: result.json.slice(0, 6000) });
        await logEvent(input.workspace.organizationId, input.projectId, input.message, name, result.ok, model);
      }
    }
  } catch {
    const fallback = await runHeuristicAgent(input.workspace, input.message, input.projectId);
    return { ...fallback, answer: `AI接続に失敗したため、読み取り結果のみ表示します。\n\n${fallback.answer}` };
  }

  await logEvent(input.workspace.organizationId, input.projectId, input.message, "max_loops", false, model);
  return {
    answer: "確認が長くなったためここで止めています。もう一度、短い質問で聞いてください。",
    tools,
    proposals,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    usedLlm: true,
  };
}
