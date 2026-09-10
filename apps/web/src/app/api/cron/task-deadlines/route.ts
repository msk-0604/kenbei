import { NextResponse } from "next/server";
import {
  TASK_DEADLINE_MAX_PAGES,
  TASK_DEADLINE_PAGE_SIZE,
  nextTaskDeadlineCursor,
  shouldFetchNextTaskDeadlinePage,
  taskDeadlineOrFilter,
  type TaskDeadlineCursor,
} from "@/features/cron/task-deadline-cursor";
import { tokyoTodayIso } from "@/lib/dates";
import { logServerInfo, logServerWarn } from "@/lib/server-log";
import { sendExpoPushToMember } from "@/lib/push";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type TaskRow = {
  id: string;
  organization_id: string;
  project_id: string;
  title: string;
  due_on: string;
  assignee_membership_id: string;
};

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const authorized = Boolean(secret) && (bearer === `Bearer ${secret}` || headerSecret === secret);
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const today = tokyoTodayIso();
  let cursor: TaskDeadlineCursor | null = null;
  let delivered = 0;
  let scanned = 0;
  let truncated = false;

  for (let page = 0; page < TASK_DEADLINE_MAX_PAGES; page += 1) {
    let query = admin
      .from("project_tasks")
      .select("id, organization_id, project_id, title, due_on, assignee_membership_id")
      .lte("due_on", today)
      .neq("status", "done")
      .is("deleted_at", null)
      .not("assignee_membership_id", "is", null)
      .order("due_on", { ascending: true })
      .order("id", { ascending: true })
      .limit(TASK_DEADLINE_PAGE_SIZE);
    if (cursor) {
      query = query.or(taskDeadlineOrFilter(cursor));
    }
    const { data: tasks } = await query;
    const rows = (tasks as TaskRow[] | null) ?? [];
    scanned += rows.length;
    for (const task of rows) {
      const membership = await admin
        .from("memberships")
        .select("profile_id")
        .eq("id", task.assignee_membership_id)
        .eq("organization_id", task.organization_id)
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();
      const profileId = (membership.data as { profile_id: string } | null)?.profile_id;
      if (!profileId) {
        continue;
      }
      const href = `/tasks/${task.id}`;
      const existing = await admin
        .from("notifications")
        .select("id")
        .eq("organization_id", task.organization_id)
        .eq("profile_id", profileId)
        .eq("kind", "task_deadline")
        .eq("href", href)
        .gte("created_at", `${today}T00:00:00+09:00`)
        .limit(1)
        .maybeSingle();
      if (existing.data) {
        continue;
      }
      const inserted = await admin
        .from("notifications")
        .insert({
          organization_id: task.organization_id,
          profile_id: profileId,
          project_id: task.project_id,
          kind: "task_deadline",
          title: "期限のタスクがあります",
          body: task.title,
          href,
        })
        .select("id")
        .maybeSingle();
      if (inserted.error) {
        continue;
      }
      await sendExpoPushToMember({
        organizationId: task.organization_id,
        profileId,
        title: "期限のタスクがあります",
        body: task.title,
        data: {
          kind: "task_deadline",
          href,
          projectId: task.project_id,
          taskId: task.id,
        },
      });
      delivered += 1;
    }
    if (!shouldFetchNextTaskDeadlinePage(rows.length)) {
      break;
    }
    cursor = nextTaskDeadlineCursor(rows);
    if (!cursor) {
      break;
    }
    if (page === TASK_DEADLINE_MAX_PAGES - 1) {
      truncated = true;
    }
  }

  if (truncated) {
    await logServerWarn("cron.task-deadlines truncated", { scanned, delivered, truncated: true });
  } else {
    await logServerInfo("cron.task-deadlines", { scanned, delivered });
  }
  return NextResponse.json({ ok: true, delivered, scanned, truncated });
}
