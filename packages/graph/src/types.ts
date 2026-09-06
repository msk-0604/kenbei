import type { CaptureFieldRecord } from "@kensapo/domain";

export type ProjectGraph = {
  id: string;
  organizationId: string;
  name: string;
  status: string;
};

export type ConfirmedCapture = {
  organizationId: string;
  projectId: string;
  captureId: string;
  membershipId?: string;
  occurredOn: string;
  createdBy: string;
  fields: CaptureFieldRecord[];
};

export type NormalizedImportRow = {
  organizationId: string;
  table: string;
  payload: Record<string, unknown>;
};

export type GraphStore = {
  insertWorkEvent(input: {
    organizationId: string;
    projectId: string;
    captureId: string;
    createdBy: string;
    workTypeKey: string | null;
    workDescription: string | null;
    location: string | null;
    issue: string | null;
    nextAction: string | null;
    note: string | null;
  }): Promise<void>;
  insertMaterialUsage(input: {
    organizationId: string;
    projectId: string;
    captureId: string;
    createdBy: string;
    occurredOn: string;
    materialCode: string;
    quantity: number;
    unit: string | null;
  }): Promise<void>;
  insertIncident(input: {
    organizationId: string;
    projectId: string;
    createdBy: string;
    occurredOn: string;
    title: string;
    action: string | null;
  }): Promise<void>;
  ensureWorkType(input: {
    organizationId: string;
    projectId: string;
    createdBy: string;
    workTypeKey: string;
  }): Promise<void>;
  markCaptureApplied(captureId: string): Promise<void>;
};

export interface ConstructionGraph {
  getProject(organizationId: string, projectId: string): Promise<ProjectGraph | null>;
  applyConfirmedCapture(input: ConfirmedCapture): Promise<void>;
  applyImport(input: NormalizedImportRow): Promise<{ table: string; id: string }>;
  rebuildFeatures(projectId: string): Promise<void>;
}
