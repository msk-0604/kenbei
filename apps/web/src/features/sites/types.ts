import type { ProgressMark, ScheduleStatus, SiteStatus, WorkDuration } from "@/lib/site-rules";

/** 現場（DB は projects + customers + project_sites）。画面ではこの形で扱う。 */
export type Site = {
  id: string;
  name: string;
  address: string | null;
  customer_name: string | null;
  manager_name: string | null;
  prime_contractor_name: string | null;
  work_type: string | null;
  caution: string | null;
  start_date: string | null;
  end_date: string | null;
  status: SiteStatus;
  memo: string | null;
  progress_remarks: string | null;
  work_duration: WorkDuration | null;
  published_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type SiteOption = Pick<Site, "id" | "name" | "customer_name" | "address">;

export type WorkerStatus = "active" | "inactive";

export type Worker = {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  trade: string | null;
  status: WorkerStatus;
  membership_id: string | null;
  created_at: string;
};

export type Schedule = {
  id: string;
  organization_id: string;
  project_id: string;
  worker_id: string | null;
  schedule_date: string;
  client_company_name: string | null;
  location: string | null;
  title: string | null;
  work_content: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  memo: string | null;
  status: ScheduleStatus;
  group_id: string | null;
  time_kind: "timed" | "am" | "pm" | "unset" | null;
  created_at: string;
  updated_at: string;
};

export type ScheduleWithDetails = Schedule & {
  worker_name: string | null;
  worker_membership_id: string | null;
  project_name: string;
};

export type ProjectProgressItem = {
  id: string;
  organization_id: string;
  project_id: string;
  category: string;
  section: string | null;
  item_name: string;
  mark: ProgressMark;
  checked: boolean;
  remarks: string | null;
  checked_at: string | null;
  checked_by: string | null;
  checked_by_name: string | null;
  sort_order: number;
  version: number;
  created_at: string;
  updated_at: string;
};

export type ProgressPreset = {
  category: string;
  section: string | null;
  item_name: string;
};

export type TodayWorker = {
  id: string;
  name: string;
  membershipId: string | null;
  scheduleId: string;
  status: ScheduleStatus;
  actualStartTime: string | null;
  actualEndTime: string | null;
};

export type TodayVisit = {
  key: string;
  projectId: string;
  projectName: string;
  customerName: string | null;
  companyName: string | null;
  place: string | null;
  address: string | null;
  workContent: string | null;
  caution: string | null;
  note: string | null;
  timeLabel: string;
  sortKey: string;
  workers: TodayWorker[];
};

export type DaySite = {
  id: string;
  name: string;
  customerName: string | null;
  address: string | null;
  status: SiteStatus;
  workDuration: WorkDuration | null;
};
