import "server-only";

import { createAiService } from "@kensapo/ai";
import { RuleDecisionEngine, type DecisionEngine } from "@kensapo/decision-engine";
import { loadOpsFacts } from "@/features/decision/facts";
import { persistOpsSignals } from "@/features/decision/persist";
import { StoreBackedConstructionGraph } from "@kensapo/graph";
import { InMemoryJobRunner } from "@kensapo/ingest";
import { RuleBasedSimilarProjectEngine } from "@kensapo/similar-projects";
import { createSupabaseGraphStore } from "@/lib/supabase/graph-store";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export function getAiService() {
  return createAiService({
    provider: process.env.AI_PROVIDER ?? "auto",
    openaiApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  });
}

export async function getConstructionGraph() {
  const supabase = await createServerSupabaseClient();
  return new StoreBackedConstructionGraph(createSupabaseGraphStore(supabase));
}

export function getSimilarProjectEngine() {
  return new RuleBasedSimilarProjectEngine();
}

export function getDecisionEngine(): DecisionEngine {
  const engine = new RuleDecisionEngine(loadOpsFacts);
  return {
    runForProject: (projectId, reason) => engine.runForProject(projectId, reason),
    listForManagement: (organizationId) => engine.listForManagement(organizationId),
    async listForToday(organizationId, membershipId) {
      const signals = await engine.listForToday(organizationId, membershipId);
      void persistOpsSignals(organizationId, signals).catch(() => undefined);
      return signals;
    },
  };
}

export function getJobRunner() {
  return new InMemoryJobRunner();
}
