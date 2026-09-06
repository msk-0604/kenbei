import "server-only";

import { isProcessDelayed } from "@kensapo/domain";
import {
  durationBand,
  durationFromPlan,
  RuleBasedSimilarProjectEngine,
  type SimilarProjectCandidate,
  type SimilarProjectResult,
} from "@kensapo/similar-projects";
import { tokyoTodayIso } from "@/lib/dates";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const WORK_HINTS: { name: string; pattern: RegExp }[] = [
  { name: "給排水", pattern: /給水|排水|配管/ },
  { name: "衛生", pattern: /衛生|トイレ/ },
  { name: "電気", pattern: /電気|配線/ },
  { name: "空調", pattern: /空調|ダクト/ },
  { name: "消防", pattern: /消防/ },
  { name: "内装", pattern: /内装/ },
  { name: "塗装", pattern: /塗装/ },
  { name: "防水", pattern: /防水/ },
  { name: "土木", pattern: /土木/ },
];

function workTypesFromText(text: string | null): string[] {
  if (!text) {
    return [];
  }
  return WORK_HINTS.filter((item) => item.pattern.test(text)).map((item) => item.name);
}

function prefectureFromAddress(address: string | null): string | undefined {
  if (!address) {
    return undefined;
  }
  const match = address.match(/(.{2,3}[都道府県])/);
  return match?.[1];
}

export async function loadSimilarCatalog(organizationId: string): Promise<SimilarProjectCandidate[]> {
  const supabase = await createServerSupabaseClient();
  const today = tokyoTodayIso();
  const [projects, processes, tasks, photos, reports, docs] = await Promise.all([
    supabase
      .from("projects")
      .select("id, organization_id, name, work_summary, caution_note, planned_start_on, planned_end_on, project_sites(address, is_primary)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    supabase
      .from("processes")
      .select("project_id, organization_id, name, percent, status, planned_end_on")
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    supabase
      .from("project_tasks")
      .select("project_id, organization_id, title, status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .neq("status", "done"),
    supabase
      .from("photos")
      .select("project_id, organization_id, work_type_key")
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    supabase
      .from("daily_reports")
      .select("project_id, organization_id, issues")
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    supabase
      .from("documents")
      .select("project_id, organization_id, title, category")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(200),
  ]);

  type Site = { address: string | null; is_primary: boolean };
  const projectRows =
    (projects.data as {
      id: string;
      organization_id: string;
      name: string;
      work_summary: string | null;
      caution_note: string | null;
      planned_start_on: string | null;
      planned_end_on: string | null;
      project_sites: Site[] | Site | null;
    }[] | null) ?? [];

  const processRows =
    (processes.data as {
      project_id: string;
      organization_id: string;
      name: string;
      percent: number;
      status: string;
      planned_end_on: string | null;
    }[] | null) ?? [];
  const taskRows =
    (tasks.data as { project_id: string; organization_id: string; title: string }[] | null) ?? [];
  const photoRows =
    (photos.data as { project_id: string; organization_id: string; work_type_key: string | null }[] | null) ?? [];
  const reportRows =
    (reports.data as { project_id: string; organization_id: string; issues: string | null }[] | null) ?? [];
  const docRows =
    (docs.data as {
      project_id: string | null;
      organization_id: string;
      title: string;
      category: string | null;
    }[] | null) ?? [];

  return projectRows
    .filter((row) => row.organization_id === organizationId)
    .map((row) => {
      const sites = Array.isArray(row.project_sites) ? row.project_sites : row.project_sites ? [row.project_sites] : [];
      const address = (sites.find((site) => site.is_primary) ?? sites[0])?.address ?? null;
      const procs = processRows.filter((item) => item.project_id === row.id && item.organization_id === organizationId);
      const durationDays = durationFromPlan(row.planned_start_on, row.planned_end_on);
      const photoTypes = photoRows
        .filter((item) => item.project_id === row.id && item.work_type_key)
        .map((item) => item.work_type_key as string);
      const workTypes = [...new Set([...workTypesFromText(row.work_summary), ...photoTypes, ...procs.map((item) => item.name)])];
      return {
        organizationId: row.organization_id,
        projectId: row.id,
        name: row.name,
        features: {
          workTypes,
          workSummary: row.work_summary ?? undefined,
          region: { prefecture: prefectureFromAddress(address) },
          durationDays,
          scaleBand: durationBand(durationDays),
        },
        processNames: procs.map((item) => item.name),
        delayedCount: procs.filter((item) =>
          isProcessDelayed({
            status: item.status,
            percent: item.percent,
            plannedEndOn: item.planned_end_on,
            todayIso: today,
          }),
        ).length,
        taskTitles: taskRows.filter((item) => item.project_id === row.id).map((item) => item.title),
        incidents: [
          row.caution_note,
          ...reportRows.filter((item) => item.project_id === row.id && item.issues).map((item) => item.issues as string),
        ].filter((item): item is string => Boolean(item)),
        lessons: docRows
          .filter((item) => item.project_id === row.id)
          .map((item) => item.title),
        durationDays,
      };
    });
}

export async function similarProjectsFor(
  organizationId: string,
  projectId: string,
): Promise<SimilarProjectResult | null> {
  const catalog = await loadSimilarCatalog(organizationId);
  const seed = catalog.find((item) => item.projectId === projectId && item.organizationId === organizationId);
  if (!seed) {
    return null;
  }
  const engine = new RuleBasedSimilarProjectEngine();
  return engine.findSimilar({
    organizationId,
    excludeProjectId: projectId,
    seed: {
      workTypes: seed.features.workTypes,
      workSummary: seed.features.workSummary,
      region: seed.features.region,
      durationDays: seed.durationDays,
      scaleBand: seed.features.scaleBand,
      processNames: seed.processNames,
    },
    candidates: catalog,
    limit: 5,
  });
}
