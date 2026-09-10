import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signedPhotoUrls } from "@/lib/signed-urls";
import { currentOrganizationId } from "@/lib/org-scope";

export type PhotoRecord = {
  id: string;
  projectId: string | null;
  projectName: string | null;
  takenAt: string;
  createdAt: string;
  capturedBy: string | null;
  capturedByName: string | null;
  workTypeKey: string | null;
  locationSpot: string | null;
  floor: string | null;
  area: string | null;
  comment: string | null;
  tags: string[];
  proposedWorkTypeKey: string | null;
  proposedLocationSpot: string | null;
  proposedDescription: string | null;
  proposedTags: string[];
  classificationStatus: string;
  storagePath: string;
  url: string | null;
};

export type PhotoSearchParams = {
  projectId?: string;
  query?: string;
  workType?: string;
  location?: string;
  capturedBy?: string;
  from?: string;
  to?: string;
  proposedOnly?: boolean;
  unfiledOnly?: boolean;
};

type PhotoRow = {
  id: string;
  project_id: string | null;
  taken_at: string;
  created_at: string;
  captured_by: string | null;
  work_type_key: string | null;
  location_spot: string | null;
  floor: string | null;
  area: string | null;
  comment: string | null;
  tags: string[] | null;
  proposed_work_type_key: string | null;
  proposed_location_spot: string | null;
  proposed_description: string | null;
  proposed_tags: string[] | null;
  classification_status: string;
  storage_path: string;
  projects: { name: string } | { name: string }[] | null;
  profiles: { display_name: string } | { display_name: string }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapPhoto(row: PhotoRow, urls: Map<string, string>): PhotoRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: one(row.projects)?.name ?? null,
    takenAt: row.taken_at,
    createdAt: row.created_at,
    capturedBy: row.captured_by,
    capturedByName: one(row.profiles)?.display_name ?? null,
    workTypeKey: row.work_type_key,
    locationSpot: row.location_spot,
    floor: row.floor,
    area: row.area,
    comment: row.comment,
    tags: row.tags ?? [],
    proposedWorkTypeKey: row.proposed_work_type_key,
    proposedLocationSpot: row.proposed_location_spot,
    proposedDescription: row.proposed_description,
    proposedTags: row.proposed_tags ?? [],
    classificationStatus: row.classification_status,
    storagePath: row.storage_path,
    url: urls.get(row.storage_path) ?? null,
  };
}

const PHOTO_SELECT =
  "id, project_id, taken_at, created_at, captured_by, work_type_key, location_spot, floor, area, comment, tags, proposed_work_type_key, proposed_location_spot, proposed_description, proposed_tags, classification_status, storage_path, projects(name), profiles:captured_by(display_name)";

export async function searchPhotos(input: PhotoSearchParams): Promise<PhotoRecord[]> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("photos")
    .select(PHOTO_SELECT)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("taken_at", { ascending: false })
    .limit(80);
  if (input.projectId) {
    query = query.eq("project_id", input.projectId);
  }
  if (input.workType) {
    query = query.eq("work_type_key", input.workType);
  }
  if (input.capturedBy) {
    query = query.eq("captured_by", input.capturedBy);
  }
  if (input.from) {
    query = query.gte("taken_at", `${input.from}T00:00:00+09:00`);
  }
  if (input.to) {
    query = query.lte("taken_at", `${input.to}T23:59:59+09:00`);
  }
  if (input.proposedOnly) {
    query = query.eq("classification_status", "proposed");
  }
  if (input.unfiledOnly) {
    query = query.in("classification_status", ["none", "proposed", "failed"]);
  }
  if (input.location) {
    const location = input.location.replace(/[%_,]/g, " ").trim();
    if (location) {
      query = query.or(
        `location_spot.ilike.%${location}%,floor.ilike.%${location}%,area.ilike.%${location}%`,
      );
    }
  }
  if (input.query) {
    const safe = input.query.replace(/[%_,]/g, " ").trim();
    if (safe) {
      query = query.ilike("search_text", `%${safe}%`);
    }
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  const rows = (data as PhotoRow[] | null) ?? [];
  const urls = await signedPhotoUrls(rows.map((row) => row.storage_path));
  return rows.map((row) => mapPhoto(row, urls));
}

export async function getPhoto(photoId: string): Promise<PhotoRecord | null> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("photos")
    .select(PHOTO_SELECT)
    .eq("id", photoId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  const row = data as PhotoRow;
  const urls = await signedPhotoUrls([row.storage_path]);
  return mapPhoto(row, urls);
}

export async function countPhotosOnDate(projectId: string, dayIso: string): Promise<number> {
  const organizationId = await currentOrganizationId();
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .gte("taken_at", `${dayIso}T00:00:00+09:00`)
    .lte("taken_at", `${dayIso}T23:59:59+09:00`);
  if (error) {
    return 0;
  }
  return count ?? 0;
}

export async function listProposedPhotos(): Promise<PhotoRecord[]> {
  return searchPhotos({ proposedOnly: true });
}
