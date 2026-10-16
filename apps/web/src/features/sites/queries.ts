import "server-only";

import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { currentOrganizationId } from "@/lib/org-scope";
import { STANDARD_PROGRESS_ITEMS } from "@/lib/standard-progress-items";
import {
  calcProgressSummary,
  formatScheduleTime,
  isSiteStatus,
  isWorkDuration,
  normalizeMark,
  scheduleSortKey,
  type ProgressSummary,
} from "@/lib/site-rules";
import { tokyoDayBounds, todayISO } from "@/lib/site-dates";
import type {
  DaySite,
  ProgressPreset,
  ProjectProgressItem,
  Schedule,
  ScheduleWithDetails,
  Site,
  SiteOption,
  TodayVisit,
  TodayWorker,
  Worker,
} from "@/features/sites/types";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asList<T>(value: T | T[] | null | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

type SiteAddress = { address: string | null; is_primary: boolean; deleted_at?: string | null };

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  work_summary: string | null;
  caution_note: string | null;
  planned_start_on: string | null;
  planned_end_on: string | null;
  work_duration: string | null;
  completed_at: string | null;
  published_at: string | null;
  manager_name: string | null;
  prime_contractor_name: string | null;
  memo: string | null;
  progress_remarks: string | null;
  created_at: string;
  customers: { name: string } | { name: string }[] | null;
  project_sites: SiteAddress | SiteAddress[] | null;
};

const SITE_SELECT =
  "id, name, status, work_summary, caution_note, planned_start_on, planned_end_on, work_duration, completed_at, published_at, manager_name, prime_contractor_name, memo, progress_remarks, created_at, customers(name), project_sites(address, is_primary, deleted_at)";

function primaryAddress(value: SiteAddress | SiteAddress[] | null): string | null {
  const sites = asList(value).filter((site) => !site.deleted_at);
  return (sites.find((site) => site.is_primary) ?? sites[0])?.address ?? null;
}

function mapSite(row: ProjectRow): Site {
  return {
    id: row.id,
    name: row.name,
    address: primaryAddress(row.project_sites),
    customer_name: one(row.customers)?.name ?? null,
    manager_name: row.manager_name,
    prime_contractor_name: row.prime_contractor_name,
    work_type: row.work_summary,
    caution: row.caution_note,
    start_date: row.planned_start_on,
    end_date: row.planned_end_on,
    status: isSiteStatus(row.status) ? row.status : "active",
    memo: row.memo,
    progress_remarks: row.progress_remarks,
    work_duration: isWorkDuration(row.work_duration) ? row.work_duration : null,
    published_at: row.published_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
  };
}

export const listSites = cache(async (): Promise<Site[]> => {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select(SITE_SELECT)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return ((data as ProjectRow[] | null) ?? []).map(mapSite);
});

export function toSiteOptions(sites: Site[]): SiteOption[] {
  return sites
    .filter((site) => site.status !== "completed" && site.status !== "cancelled")
    .map(({ id, name, customer_name, address }) => ({ id, name, customer_name, address }));
}

export const getSite = cache(async (projectId: string): Promise<Site | null> => {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select(SITE_SELECT)
    .eq("id", projectId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? mapSite(data as ProjectRow) : null;
});

/** 完了した現場だけ。完了日（日本時間）で絞り込み、新しい順。 */
export async function listCompletedSites(range: { from?: string; to?: string }): Promise<Site[]> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("projects")
    .select(SITE_SELECT)
    .eq("organization_id", organizationId)
    .eq("status", "completed")
    .is("deleted_at", null)
    .order("completed_at", { ascending: false, nullsFirst: false });
  if (range.from) {
    query = query.gte("completed_at", tokyoDayBounds(range.from).start);
  }
  if (range.to) {
    query = query.lte("completed_at", tokyoDayBounds(range.to).end);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return ((data as ProjectRow[] | null) ?? []).map(mapSite);
}

export async function countSitePhotos(projectId: string): Promise<number> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .is("deleted_at", null);
  return count ?? 0;
}

// ---- 作業員 ---------------------------------------------------------------

export const listWorkers = cache(async (): Promise<Worker[]> => {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("workers")
    .select("id, organization_id, name, phone, trade, status, membership_id, created_at")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return (data as Worker[] | null) ?? [];
});

export async function getWorker(workerId: string): Promise<Worker | null> {
  const workers = await listWorkers();
  return workers.find((worker) => worker.id === workerId) ?? null;
}

// ---- 予定 -----------------------------------------------------------------

type ScheduleRow = Schedule & {
  workers: { name: string; membership_id: string | null } | { name: string; membership_id: string | null }[] | null;
  projects: { name: string } | { name: string }[] | null;
};

const SCHEDULE_SELECT =
  "id, organization_id, project_id, worker_id, schedule_date, client_company_name, location, title, work_content, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, memo, status, group_id, time_kind, created_at, updated_at, workers(name, membership_id), projects!inner(name, deleted_at)";

function mapSchedule(row: ScheduleRow): ScheduleWithDetails {
  const worker = one(row.workers);
  const { workers: _workers, projects, ...rest } = row;
  void _workers;
  return {
    ...rest,
    worker_name: worker?.name ?? null,
    worker_membership_id: worker?.membership_id ?? null,
    project_name: one(projects)?.name ?? "現場",
  };
}

export async function getSchedulesForDate(date: string): Promise<ScheduleWithDetails[]> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("schedules")
    .select(SCHEDULE_SELECT)
    .eq("organization_id", organizationId)
    .eq("schedule_date", date)
    .is("projects.deleted_at", null)
    .order("scheduled_start_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return ((data as ScheduleRow[] | null) ?? []).map(mapSchedule);
}

export async function getSchedulesForProject(projectId: string, fromDate = todayISO()): Promise<ScheduleWithDetails[]> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("schedules")
    .select(SCHEDULE_SELECT)
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .gte("schedule_date", fromDate)
    .order("schedule_date", { ascending: true })
    .limit(14);
  if (error) {
    throw new Error(error.message);
  }
  return ((data as ScheduleRow[] | null) ?? []).map(mapSchedule);
}

/** 日付ごとの現場数（同じ現場に作業員が何人いても1件） */
export function countSchedulesByDate(rows: readonly { schedule_date: string; project_id: string }[]): Record<string, number> {
  const byDate: Record<string, Set<string>> = {};
  for (const row of rows) {
    (byDate[row.schedule_date] ??= new Set()).add(row.project_id);
  }
  return Object.fromEntries(Object.entries(byDate).map(([date, ids]) => [date, ids.size]));
}

export async function getScheduleCountsForRange(startDate: string, endDate: string): Promise<Record<string, number>> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("schedules")
    .select("schedule_date, project_id, projects!inner(deleted_at)")
    .eq("organization_id", organizationId)
    .gte("schedule_date", startDate)
    .lte("schedule_date", endDate)
    .is("projects.deleted_at", null);
  if (error) {
    throw new Error(error.message);
  }
  return countSchedulesByDate((data as { schedule_date: string; project_id: string }[] | null) ?? []);
}

type VisitProject = {
  name: string;
  caution_note: string | null;
  memo: string | null;
  customers: { name: string } | { name: string }[] | null;
  project_sites: SiteAddress | SiteAddress[] | null;
};

type VisitRow = Pick<
  Schedule,
  | "id"
  | "project_id"
  | "worker_id"
  | "work_content"
  | "client_company_name"
  | "location"
  | "scheduled_start_time"
  | "scheduled_end_time"
  | "memo"
  | "group_id"
  | "time_kind"
  | "status"
  | "actual_start_time"
  | "actual_end_time"
> & {
  workers: { name: string; membership_id: string | null } | { name: string; membership_id: string | null }[] | null;
  projects: VisitProject | VisitProject[] | null;
};

/** その日の予定を「現場への訪問」ごとにまとめる（同じグループの作業員は1枚のカードに） */
export async function getTodayVisits(date: string): Promise<TodayVisit[]> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("schedules")
    .select(
      "id, project_id, worker_id, work_content, client_company_name, location, scheduled_start_time, scheduled_end_time, memo, group_id, time_kind, status, actual_start_time, actual_end_time, workers(name, membership_id), projects!inner(name, caution_note, memo, deleted_at, customers(name), project_sites(address, is_primary, deleted_at))",
    )
    .eq("organization_id", organizationId)
    .eq("schedule_date", date)
    .neq("status", "cancelled")
    .is("projects.deleted_at", null);
  if (error) {
    throw new Error(error.message);
  }

  const grouped = new Map<string, TodayVisit>();
  for (const row of (data as VisitRow[] | null) ?? []) {
    const project = one(row.projects);
    const worker = one(row.workers);
    const key =
      row.group_id ||
      [
        row.project_id,
        row.time_kind ?? "",
        row.scheduled_start_time ?? "",
        row.scheduled_end_time ?? "",
        row.work_content ?? "",
        row.client_company_name ?? "",
        row.location ?? "",
        row.memo ?? "",
      ].join("|");

    const person: TodayWorker | null =
      row.worker_id && worker
        ? {
            id: row.worker_id,
            name: worker.name,
            membershipId: worker.membership_id,
            scheduleId: row.id,
            status: row.status,
            actualStartTime: row.actual_start_time,
            actualEndTime: row.actual_end_time,
          }
        : null;

    const existing = grouped.get(key);
    if (existing) {
      if (person && !existing.workers.some((w) => w.id === person.id)) {
        existing.workers.push(person);
      }
      continue;
    }
    grouped.set(key, {
      key,
      projectId: row.project_id,
      projectName: project?.name ?? "現場",
      customerName: one(project?.customers)?.name ?? null,
      companyName: row.client_company_name,
      place: row.location,
      address: primaryAddress(project?.project_sites ?? null),
      workContent: row.work_content,
      caution: project?.caution_note ?? null,
      note: row.memo,
      timeLabel: formatScheduleTime(row.time_kind, row.scheduled_start_time, row.scheduled_end_time),
      sortKey: scheduleSortKey(row.time_kind, row.scheduled_start_time),
      workers: person ? [person] : [],
    });
  }
  return [...grouped.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey, "ja"));
}

type DaySiteRow = {
  projects:
    | {
        id: string;
        name: string;
        status: string;
        work_duration: string | null;
        deleted_at: string | null;
        customers: { name: string } | { name: string }[] | null;
        project_sites: SiteAddress | SiteAddress[] | null;
      }
    | null;
};

/** カレンダーの日付をタップしたときの「その日の現場」 */
export async function getDaySites(date: string): Promise<DaySite[]> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("schedules")
    .select(
      "project_id, projects!inner(id, name, status, work_duration, deleted_at, customers(name), project_sites(address, is_primary, deleted_at))",
    )
    .eq("organization_id", organizationId)
    .eq("schedule_date", date)
    .is("projects.deleted_at", null);
  if (error) {
    throw new Error(error.message);
  }
  const byId = new Map<string, DaySite>();
  for (const row of (data as unknown as DaySiteRow[] | null) ?? []) {
    const project = one(row.projects);
    if (!project || byId.has(project.id)) {
      continue;
    }
    byId.set(project.id, {
      id: project.id,
      name: project.name,
      customerName: one(project.customers)?.name ?? null,
      address: primaryAddress(project.project_sites),
      status: isSiteStatus(project.status) ? project.status : "active",
      workDuration: isWorkDuration(project.work_duration) ? project.work_duration : null,
    });
  }
  return [...byId.values()];
}

// ---- 作業工程 --------------------------------------------------------------

const PROGRESS_SELECT =
  "id, organization_id, project_id, category, section, item_name, mark, checked, remarks, checked_at, checked_by, checked_by_name, sort_order, version, created_at, updated_at";

export async function getProgressItems(projectId: string): Promise<ProjectProgressItem[]> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_progress_items")
    .select(PROGRESS_SELECT)
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return ((data as ProjectProgressItem[] | null) ?? []).map((item) => ({
    ...item,
    mark: normalizeMark(item.mark, item.checked),
  }));
}

export async function getAllProjectsProgressSummaries(): Promise<
  (ProgressSummary & { project_id: string; project_name: string })[]
> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_progress_items")
    .select("mark, project_id, projects!inner(name, status, deleted_at)")
    .eq("organization_id", organizationId)
    .neq("projects.status", "completed")
    .is("projects.deleted_at", null);
  if (error) {
    throw new Error(error.message);
  }
  const grouped = new Map<string, { project_name: string; items: { mark: string }[] }>();
  for (const row of (data as { mark: string; project_id: string; projects: { name: string } | { name: string }[] | null }[] | null) ?? []) {
    const project = one(row.projects);
    if (!project) {
      continue;
    }
    const entry = grouped.get(row.project_id) ?? { project_name: project.name, items: [] };
    entry.items.push({ mark: row.mark });
    grouped.set(row.project_id, entry);
  }
  return [...grouped.entries()].map(([project_id, value]) => ({
    project_id,
    project_name: value.project_name,
    ...calcProgressSummary(value.items),
  }));
}

/** 会社ごとの「よく使う項目」。未登録なら標準候補（水道・管工事）。 */
export const getProgressPresets = cache(async (): Promise<{ items: ProgressPreset[]; custom: boolean }> => {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("progress_item_presets")
    .select("category, section, item_name")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const rows = (data as ProgressPreset[] | null) ?? [];
  if (error || rows.length === 0) {
    return { items: STANDARD_PROGRESS_ITEMS, custom: false };
  }
  return { items: rows, custom: true };
});

/** 記録した人の名前（profile id → 表示名） */
export async function getMemberNames(): Promise<Record<string, string>> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("memberships")
    .select("profile_id, profiles!profile_id(display_name)")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  const names: Record<string, string> = {};
  for (const row of (data as { profile_id: string; profiles: { display_name: string } | { display_name: string }[] | null }[] | null) ?? []) {
    names[row.profile_id] = one(row.profiles)?.display_name ?? "メンバー";
  }
  return names;
}
