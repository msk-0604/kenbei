import type { SignalKind } from "@kensapo/domain";
import { buildOpsSignals, briefTodayInJapanese, type OpsFacts } from "./rules";

export type SignalDraft = {
  kind: SignalKind;
  code: string;
  title: string;
  projectId: string;
  severity: "low" | "medium" | "high";
  evidence: Record<string, unknown>;
  detector: string;
  confidence?: number;
};

export type Signal = SignalDraft & {
  id: string;
  status: "open" | "acknowledged" | "accepted" | "dismissed";
};

export type ProjectContext = {
  organizationId: string;
  projectId: string;
};

export interface Detector {
  id: string;
  evaluate(ctx: ProjectContext): Promise<SignalDraft[]>;
}

export interface DecisionEngine {
  runForProject(projectId: string, reason: string): Promise<void>;
  listForManagement(organizationId: string): Promise<Signal[]>;
  listForToday(organizationId: string, membershipId: string): Promise<Signal[]>;
}

export class NoopDecisionEngine implements DecisionEngine {
  async runForProject(_projectId?: string, _reason?: string): Promise<void> {}
  async listForManagement(): Promise<Signal[]> {
    return [];
  }
  async listForToday(): Promise<Signal[]> {
    return [];
  }
}

export class RuleDecisionEngine implements DecisionEngine {
  constructor(private readonly loadFacts: (organizationId: string) => Promise<OpsFacts>) {}

  async runForProject(_projectId?: string, _reason?: string): Promise<void> {}

  async listForManagement(organizationId: string): Promise<Signal[]> {
    return this.listForToday(organizationId, "");
  }

  async listForToday(organizationId: string, _membershipId?: string): Promise<Signal[]> {
    const facts = await this.loadFacts(organizationId);
    if (facts.organizationId !== organizationId) {
      return [];
    }
    return buildOpsSignals(facts).map((item, index) => ({
      id: `${item.type}:${item.refId ?? index}`,
      kind: "caution" as const,
      code: item.type,
      title: item.title,
      projectId: item.projectId ?? "",
      severity: item.severity,
      evidence: { reason: item.reason, source: item.source },
      detector: "rules",
      status: "open" as const,
    }));
  }
}

export { buildOpsSignals, briefTodayInJapanese };
export type { OpsFacts };
