import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signedPhotoUrls } from "@/lib/signed-urls";
import { currentOrganizationId } from "@/lib/org-scope";

export type DailyReportRecord = {
  id: string;
  projectId: string;
  projectName: string;
  workOn: string;
  status: string;
  body: string;
  weather: string | null;
  workLocation: string | null;
  workerCount: number | null;
  partnerCompaniesText: string | null;
  equipmentText: string | null;
  progressNote: string | null;
  issues: string | null;
  safetyNotes: string | null;
  tomorrowPlan: string | null;
  remarks: string | null;
  draftSource: string;
  authorName: string | null;
  photoIds: string[];
  photoUrls: { id: string; url: string }[];
};

type ReportRow = {
  id: string;
  project_id: string;
  work_on: string;
  status: string;
  body: string;
  weather: string | null;
  work_location: string | null;
  worker_count: number | null;
  partner_companies_text: string | null;
  equipment_text: string | null;
  progress_note: string | null;
  issues: string | null;
  safety_notes: string | null;
  tomorrow_plan: string | null;
  remarks: string | null;
  draft_source: string;
  projects: { name: string } | { name: string }[] | null;
  profiles: { display_name: string } | { display_name: string }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function listProjectReports(projectId: string): Promise<DailyReportRecord[]> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("daily_reports")
    .select(
      "id, project_id, work_on, status, body, weather, work_location, worker_count, partner_companies_text, equipment_text, progress_note, issues, safety_notes, tomorrow_plan, remarks, draft_source, projects(name), profiles:created_by(display_name)",
    )
    .eq("project_id", projectId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("work_on", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return ((data as ReportRow[] | null) ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: one(row.projects)?.name ?? "",
    workOn: row.work_on,
    status: row.status,
    body: row.body,
    weather: row.weather,
    workLocation: row.work_location,
    workerCount: row.worker_count,
    partnerCompaniesText: row.partner_companies_text,
    equipmentText: row.equipment_text,
    progressNote: row.progress_note,
    issues: row.issues,
    safetyNotes: row.safety_notes,
    tomorrowPlan: row.tomorrow_plan,
    remarks: row.remarks,
    draftSource: row.draft_source,
    authorName: one(row.profiles)?.display_name ?? null,
    photoIds: [],
    photoUrls: [],
  }));
}

export async function getReport(reportId: string): Promise<DailyReportRecord | null> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("daily_reports")
    .select(
      "id, project_id, work_on, status, body, weather, work_location, worker_count, partner_companies_text, equipment_text, progress_note, issues, safety_notes, tomorrow_plan, remarks, draft_source, projects(name), profiles:created_by(display_name)",
    )
    .eq("id", reportId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  const row = data as ReportRow;
  const links = await supabase
    .from("daily_report_photos")
    .select("photo_id, photos(storage_path)")
    .eq("report_id", reportId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("sort_order");
  type LinkRow = { photo_id: string; photos: { storage_path: string } | { storage_path: string }[] | null };
  const linkRows = (links.data as LinkRow[] | null) ?? [];
  const paths = linkRows
    .map((item) => one(item.photos)?.storage_path)
    .filter((path): path is string => Boolean(path));
  const urls = await signedPhotoUrls(paths);
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: one(row.projects)?.name ?? "",
    workOn: row.work_on,
    status: row.status,
    body: row.body,
    weather: row.weather,
    workLocation: row.work_location,
    workerCount: row.worker_count,
    partnerCompaniesText: row.partner_companies_text,
    equipmentText: row.equipment_text,
    progressNote: row.progress_note,
    issues: row.issues,
    safetyNotes: row.safety_notes,
    tomorrowPlan: row.tomorrow_plan,
    remarks: row.remarks,
    draftSource: row.draft_source,
    authorName: one(row.profiles)?.display_name ?? null,
    photoIds: linkRows.map((item) => item.photo_id),
    photoUrls: linkRows.flatMap((item) => {
      const path = one(item.photos)?.storage_path;
      const url = path ? urls.get(path) : undefined;
      return url ? [{ id: item.photo_id, url }] : [];
    }),
  };
}

export async function getReportOnDate(projectId: string, workOn: string): Promise<DailyReportRecord | null> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("daily_reports")
    .select("id")
    .eq("project_id", projectId)
    .eq("organization_id", organizationId)
    .eq("work_on", workOn)
    .is("deleted_at", null)
    .maybeSingle();
  const row = data as { id: string } | null;
  if (!row) {
    return null;
  }
  return getReport(row.id);
}

export async function listDraftReports(): Promise<DailyReportRecord[]> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("daily_reports")
    .select(
      "id, project_id, work_on, status, body, weather, work_location, worker_count, partner_companies_text, equipment_text, progress_note, issues, safety_notes, tomorrow_plan, remarks, draft_source, projects(name), profiles:created_by(display_name)",
    )
    .eq("organization_id", organizationId)
    .eq("status", "draft")
    .is("deleted_at", null)
    .order("work_on", { ascending: false })
    .limit(30);
  if (error) {
    throw new Error(error.message);
  }
  return ((data as ReportRow[] | null) ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: one(row.projects)?.name ?? "",
    workOn: row.work_on,
    status: row.status,
    body: row.body,
    weather: row.weather,
    workLocation: row.work_location,
    workerCount: row.worker_count,
    partnerCompaniesText: row.partner_companies_text,
    equipmentText: row.equipment_text,
    progressNote: row.progress_note,
    issues: row.issues,
    safetyNotes: row.safety_notes,
    tomorrowPlan: row.tomorrow_plan,
    remarks: row.remarks,
    draftSource: row.draft_source,
    authorName: one(row.profiles)?.display_name ?? null,
    photoIds: [],
    photoUrls: [],
  }));
}

export async function listRecentReports(): Promise<DailyReportRecord[]> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("daily_reports")
    .select(
      "id, project_id, work_on, status, body, weather, work_location, worker_count, partner_companies_text, equipment_text, progress_note, issues, safety_notes, tomorrow_plan, remarks, draft_source, projects(name), profiles:created_by(display_name)",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("work_on", { ascending: false })
    .limit(40);
  if (error) {
    throw new Error(error.message);
  }
  return ((data as ReportRow[] | null) ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: one(row.projects)?.name ?? "",
    workOn: row.work_on,
    status: row.status,
    body: row.body,
    weather: row.weather,
    workLocation: row.work_location,
    workerCount: row.worker_count,
    partnerCompaniesText: row.partner_companies_text,
    equipmentText: row.equipment_text,
    progressNote: row.progress_note,
    issues: row.issues,
    safetyNotes: row.safety_notes,
    tomorrowPlan: row.tomorrow_plan,
    remarks: row.remarks,
    draftSource: row.draft_source,
    authorName: one(row.profiles)?.display_name ?? null,
    photoIds: [],
    photoUrls: [],
  }));
}

export type PrintCompany = {
  name: string;
  logoUrl: string | null;
};

export async function getPrintCompany(fallbackName: string): Promise<PrintCompany> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("organization_settings")
    .select("company_display_name, logo_storage_path")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const row = data as { company_display_name: string | null; logo_storage_path: string | null } | null;
  let logoUrl: string | null = null;
  if (row?.logo_storage_path) {
    const signed = await supabase.storage.from("org-files").createSignedUrl(row.logo_storage_path, 60 * 60);
    logoUrl = signed.data?.signedUrl ?? null;
  }
  return { name: row?.company_display_name || fallbackName, logoUrl };
}
