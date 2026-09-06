import { planConfirmedCaptureWrites } from "./plan";
import type { ConfirmedCapture, ConstructionGraph, GraphStore, NormalizedImportRow, ProjectGraph } from "./types";

export class StoreBackedConstructionGraph implements ConstructionGraph {
  constructor(private readonly store: GraphStore) {}

  async getProject(): Promise<ProjectGraph | null> {
    return null;
  }

  async applyConfirmedCapture(input: ConfirmedCapture): Promise<void> {
    const writes = planConfirmedCaptureWrites(input);
    for (const write of writes) {
      if (write.kind === "work_event") {
        await this.store.insertWorkEvent({
          organizationId: input.organizationId,
          projectId: input.projectId,
          captureId: input.captureId,
          createdBy: input.createdBy,
          workTypeKey: write.workTypeKey,
          workDescription: write.workDescription,
          location: write.location,
          issue: write.issue,
          nextAction: write.nextAction,
          note: write.note,
        });
      }
      if (write.kind === "material_usage") {
        await this.store.insertMaterialUsage({
          organizationId: input.organizationId,
          projectId: input.projectId,
          captureId: input.captureId,
          createdBy: input.createdBy,
          occurredOn: input.occurredOn,
          materialCode: write.materialCode,
          quantity: write.quantity,
          unit: write.unit,
        });
      }
      if (write.kind === "incident") {
        await this.store.insertIncident({
          organizationId: input.organizationId,
          projectId: input.projectId,
          createdBy: input.createdBy,
          occurredOn: input.occurredOn,
          title: write.title,
          action: write.action,
        });
      }
      if (write.kind === "work_type") {
        await this.store.ensureWorkType({
          organizationId: input.organizationId,
          projectId: input.projectId,
          createdBy: input.createdBy,
          workTypeKey: write.workTypeKey,
        });
      }
    }
    await this.store.markCaptureApplied(input.captureId);
  }

  async applyImport(): Promise<never> {
    throw new Error("ConstructionGraph.applyImport is not implemented yet");
  }

  async rebuildFeatures(): Promise<void> {
    return;
  }
}
