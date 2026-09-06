import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ProjectListItem = {
  id: string;
  name: string;
  status: string;
  address: string | null;
  customerName: string | null;
  plannedEndOn: string | null;
};

type Site = { address: string | null; is_primary: boolean };
type ProjectRow = {
  id: string;
  name: string;
  status: string;
  planned_end_on: string | null;
  customers: { name: string } | { name: string }[] | null;
  project_sites: Site[] | Site | null;
};

function asList<T>(value: T[] | T | null): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export async function listProjects(): Promise<ProjectListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, status, planned_end_on, customers(name), project_sites(address, is_primary)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return ((data as ProjectRow[] | null) ?? []).map((row) => {
    const sites = asList(row.project_sites);
    const primary = sites.find((site) => site.is_primary) ?? sites[0];
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      address: primary?.address ?? null,
      customerName: asList(row.customers as { name: string }[] | { name: string } | null)[0]?.name ?? null,
      plannedEndOn: row.planned_end_on,
    };
  });
}

export type ProjectDetail = {
  id: string;
  name: string;
  status: string;
  workSummary: string | null;
  cautionNote: string | null;
  address: string | null;
  customerName: string | null;
  plannedStartOn: string | null;
  plannedEndOn: string | null;
};

export async function getProject(projectId: string): Promise<ProjectDetail | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, name, status, work_summary, caution_note, planned_start_on, planned_end_on, customers(name), project_sites(address, is_primary)",
    )
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  const row = data as
    | {
        id: string;
        name: string;
        status: string;
        work_summary: string | null;
        caution_note: string | null;
        planned_start_on: string | null;
        planned_end_on: string | null;
        customers: { name: string } | { name: string }[] | null;
        project_sites: Site[] | Site | null;
      }
    | null;
  if (!row) {
    return null;
  }
  const sites = asList(row.project_sites);
  const primary = sites.find((site) => site.is_primary) ?? sites[0];
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    workSummary: row.work_summary,
    cautionNote: row.caution_note,
    address: primary?.address ?? null,
    customerName: asList(row.customers)[0]?.name ?? null,
    plannedStartOn: row.planned_start_on,
    plannedEndOn: row.planned_end_on,
  };
}

export type AssignmentRow = {
  id: string;
  membershipId: string;
  displayName: string;
  roleInProject: string;
  startsOn: string | null;
  endsOn: string | null;
  status: string;
};

export async function listAssignments(projectId: string): Promise<AssignmentRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_members")
    .select(
      "id, membership_id, role_in_project, starts_on, ends_on, status, memberships(profiles!profile_id(display_name))",
    )
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  type Row = {
    id: string;
    membership_id: string;
    role_in_project: string;
    starts_on: string | null;
    ends_on: string | null;
    status: string;
    memberships:
      | { profiles: { display_name: string } | { display_name: string }[] | null }
      | { profiles: { display_name: string } | { display_name: string }[] | null }[]
      | null;
  };
  const unwrap = <T,>(value: T | T[] | null | undefined): T | null =>
    !value ? null : Array.isArray(value) ? (value[0] ?? null) : value;

  return ((data as Row[] | null) ?? []).map((row) => {
    const membership = unwrap(row.memberships);
    const profile = unwrap(membership?.profiles ?? null);
    return {
      id: row.id,
      membershipId: row.membership_id,
      displayName: profile?.display_name ?? "メンバー",
      roleInProject: row.role_in_project,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      status: row.status,
      };
  });
}

export type OrgMemberOption = {
  membershipId: string;
  displayName: string;
  roleCode: string;
};

export async function listOrgMembers(): Promise<OrgMemberOption[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("id, profiles!profile_id(display_name), roles(code)")
    .eq("status", "active")
    .is("deleted_at", null);
  if (error) {
    throw new Error(error.message);
  }
  type Row = {
    id: string;
    profiles: { display_name: string } | { display_name: string }[] | null;
    roles: { code: string } | { code: string }[] | null;
  };
  const unwrap = <T,>(value: T | T[] | null): T | null =>
    !value ? null : Array.isArray(value) ? (value[0] ?? null) : value;
  return ((data as Row[] | null) ?? []).map((row) => ({
    membershipId: row.id,
    displayName: unwrap(row.profiles)?.display_name ?? "メンバー",
    roleCode: unwrap(row.roles)?.code ?? "worker",
  }));
}

export type CaptureListItem = {
  id: string;
  transcript: string | null;
  createdAt: string;
  graphAppliedAt: string | null;
  pendingCount: number;
};

export async function listProjectCaptures(projectId: string): Promise<CaptureListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("captures")
    .select("id, transcript, created_at, graph_applied_at, capture_fields(status)")
    .eq("project_id", projectId)
    .eq("kind", "voice")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  type Row = {
    id: string;
    transcript: string | null;
    created_at: string;
    graph_applied_at: string | null;
    capture_fields: { status: string }[] | { status: string } | null;
  };
  return ((data as Row[] | null) ?? []).map((row) => {
    const fields = Array.isArray(row.capture_fields)
      ? row.capture_fields
      : row.capture_fields
        ? [row.capture_fields]
        : [];
    return {
      id: row.id,
      transcript: row.transcript,
      createdAt: row.created_at,
      graphAppliedAt: row.graph_applied_at,
      pendingCount: fields.filter((field) => field.status === "pending").length,
    };
  });
}

export type WorkEventRow = {
  id: string;
  workTypeKey: string | null;
  workDescription: string | null;
  location: string | null;
  issue: string | null;
  nextAction: string | null;
  createdAt: string;
};

export async function listWorkEvents(projectId: string): Promise<WorkEventRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("work_events")
    .select("id, work_type_key, work_description, location, issue, next_action, created_at")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  type Row = {
    id: string;
    work_type_key: string | null;
    work_description: string | null;
    location: string | null;
    issue: string | null;
    next_action: string | null;
    created_at: string;
  };
  return ((data as Row[] | null) ?? []).map((row) => ({
    id: row.id,
    workTypeKey: row.work_type_key,
    workDescription: row.work_description,
    location: row.location,
    issue: row.issue,
    nextAction: row.next_action,
    createdAt: row.created_at,
  }));
}

export async function listConfirmedFields(projectId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("capture_fields")
    .select("id, field_key, confirmed_value_json, status, created_at")
    .eq("project_id", projectId)
    .in("status", ["confirmed", "corrected", "auto_accepted"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    throw new Error(error.message);
  }
  return (data as
    | {
        id: string;
        field_key: string;
        confirmed_value_json: unknown;
        status: string;
        created_at: string;
      }[]
    | null) ?? [];
}
