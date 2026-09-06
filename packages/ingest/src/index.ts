export type ImportKind =
  | "csv_projects"
  | "csv_customers"
  | "csv_members"
  | "photos_bulk"
  | "pdf_bulk";

export type ImportSource = "csv" | "excel" | "andpad" | "kanna";

export type ImportJob = {
  organizationId: string;
  kind: ImportKind;
  source: ImportSource;
  storagePath: string;
};

export type NormalizedImportRow = {
  rowNo: number;
  payload: Record<string, unknown>;
};

/**
 * Importers normalize only. They write Graph via @kensapo/graph, never raw SQL from UI.
 * ANDPAD / KANNA adapters can implement this later.
 */
export interface Importer {
  kind: ImportKind;
  parse(job: ImportJob): Promise<NormalizedImportRow[]>;
}

export interface JobRunner {
  enqueue(kind: string, payload: Record<string, unknown>, runAfter?: Date): Promise<string>;
}

export class InMemoryJobRunner implements JobRunner {
  async enqueue(): Promise<string> {
    return "job-not-persisted";
  }
}
