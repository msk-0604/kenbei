export type {
  ConfirmedCapture,
  ConstructionGraph,
  GraphStore,
  NormalizedImportRow,
  ProjectGraph,
} from "./types";
export { planConfirmedCaptureWrites } from "./plan";
export type { GraphWrite } from "./plan";
export { StoreBackedConstructionGraph } from "./store-graph";

import type { ConstructionGraph } from "./types";

export class UnimplementedConstructionGraph implements ConstructionGraph {
  async getProject(): Promise<null> {
    return null;
  }

  async applyConfirmedCapture(): Promise<void> {
    throw new Error("ConstructionGraph.applyConfirmedCapture is not implemented yet");
  }

  async applyImport(): Promise<never> {
    throw new Error("ConstructionGraph.applyImport is not implemented yet");
  }

  async rebuildFeatures(): Promise<void> {
    throw new Error("ConstructionGraph.rebuildFeatures is not implemented yet");
  }
}
