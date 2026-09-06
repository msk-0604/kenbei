import * as FileSystem from "expo-file-system/legacy";
import { reportDraftKey, type LocalReportDraft } from "./report-draft-logic";

const ROOT = `${FileSystem.documentDirectory ?? ""}kenbei-report-drafts/`;
const INDEX = `${ROOT}drafts.json`;
const INDEX_TMP = `${ROOT}drafts.json.tmp`;

let memory: Record<string, LocalReportDraft> | null = null;
let writeTail: Promise<void> = Promise.resolve();

function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeTail.then(fn, fn);
  writeTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(ROOT);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
  }
}

async function persist(map: Record<string, LocalReportDraft>): Promise<void> {
  await ensureDir();
  await FileSystem.writeAsStringAsync(INDEX_TMP, JSON.stringify(map));
  const dest = await FileSystem.getInfoAsync(INDEX);
  if (dest.exists) {
    await FileSystem.deleteAsync(INDEX, { idempotent: true });
  }
  await FileSystem.moveAsync({ from: INDEX_TMP, to: INDEX });
  memory = map;
}

export async function loadReportDrafts(): Promise<Record<string, LocalReportDraft>> {
  await ensureDir();
  const info = await FileSystem.getInfoAsync(INDEX);
  if (!info.exists) {
    memory = {};
    return {};
  }
  try {
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(INDEX)) as Record<string, LocalReportDraft>;
    memory = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    memory = {};
  }
  return memory;
}

export async function getReportDraft(
  organizationId: string,
  projectId: string,
  workOn: string,
): Promise<LocalReportDraft | null> {
  const map = memory ?? (await loadReportDrafts());
  return map[reportDraftKey(organizationId, projectId, workOn)] ?? null;
}

export async function saveReportDraft(draft: LocalReportDraft): Promise<void> {
  await enqueueWrite(async () => {
    const map = { ...(memory ?? (await loadReportDrafts())) };
    map[reportDraftKey(draft.organizationId, draft.projectId, draft.workOn)] = draft;
    await persist(map);
  });
}

export async function clearReportDraft(organizationId: string, projectId: string, workOn: string): Promise<void> {
  await enqueueWrite(async () => {
    const map = { ...(memory ?? (await loadReportDrafts())) };
    delete map[reportDraftKey(organizationId, projectId, workOn)];
    await persist(map);
  });
}
