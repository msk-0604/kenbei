import "server-only";

import { briefTodayInJapanese } from "@kensapo/decision-engine";
import {
  classifyPhotoHeuristic,
  isAllowedStrategistTool,
  isBlockedStrategistTool,
  photoAssistFromFilename,
  proposeTaskTitles,
  sanitizeStrategistToolArgs,
  type StrategistToolName,
} from "@kensapo/ai";
import { can } from "@/lib/authz-guard";
import { tokyoTodayIso } from "@/lib/dates";
import { getDecisionEngine } from "@/lib/engines";
import { listProjectMessages } from "@/features/chat/queries";
import { loadOpsBriefFacts } from "@/features/strategist/facts";
import { searchPhotos } from "@/features/photos/queries";
import { listDraftReports, listRecentReports } from "@/features/reports/queries";
import { similarProjectsFor } from "@/features/similar/queries";
import { listDelayedProcesses, listOpenTasks } from "@/features/site-ops/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/session";

export type StrategistProposal =
  | {
      kind: "report_draft";
      projectId: string;
      projectName: string;
      summary: string;
    }
  | {
      kind: "create_tasks";
      projectId: string;
      projectName: string;
      titles: string[];
    }
  | {
      kind: "photo_classify";
      projectId: string | null;
      items: { photoId: string; label: string }[];
    };

export type ToolRunResult = {
  name: string;
  ok: boolean;
  json: string;
  proposal?: StrategistProposal;
};

async function ownedProject(
  workspace: Workspace,
  projectId: string | null,
): Promise<{ id: string; name: string } | null> {
  if (!projectId) {
    return null;
  }
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("organization_id", workspace.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  const row = data as { id: string; name: string } | null;
  return row;
}

function compact<T>(rows: T[], max = 20): T[] {
  return rows.slice(0, max);
}

export async function runStrategistTool(
  workspace: Workspace,
  name: string,
  rawArgs: Record<string, unknown>,
  fallbackProjectId: string | null,
): Promise<ToolRunResult> {
  if (isBlockedStrategistTool(name) && !isAllowedStrategistTool(name)) {
    return { name, ok: false, json: JSON.stringify({ error: "この操作はAI軍師では実行できません。" }) };
  }
  if (!isAllowedStrategistTool(name)) {
    return { name, ok: false, json: JSON.stringify({ error: "未登録のツールです。" }) };
  }
  const args = sanitizeStrategistToolArgs(rawArgs);
  const project = await ownedProject(workspace, args.projectId ?? fallbackProjectId);
  const projectId = project?.id ?? null;
  const today = tokyoTodayIso();

  try {
    return await executeLevelTool(workspace, name, {
      projectId,
      projectName: project?.name ?? "",
      titles: args.titles,
      photoIds: args.photoIds,
      today,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "tool failed";
    return { name, ok: false, json: JSON.stringify({ error: message }) };
  }
}

async function executeLevelTool(
  workspace: Workspace,
  name: StrategistToolName,
  ctx: { projectId: string | null; projectName: string; titles: string[]; photoIds: string[]; today: string },
): Promise<ToolRunResult> {
  const facts = await loadOpsBriefFacts(workspace.organizationId, ctx.projectId);

  if (name === "get_today_brief" || name === "get_today_actions") {
    const engine = getDecisionEngine();
    const signals = await engine.listForToday(workspace.organizationId, workspace.membershipId);
    const mapped = signals.map((item) => ({ title: item.title, reason: String(item.evidence.reason ?? item.title) }));
    const text = briefTodayInJapanese(mapped);
    return {
      name,
      ok: true,
      json: JSON.stringify({
        brief: text,
        delayed: facts.delayedProcessNames,
        overdue: facts.overdueTaskTitles,
        pending: facts.pendingConfirmCount,
        drafts: facts.draftReportCount,
      }),
    };
  }

  if (name === "get_overdue_tasks" || name === "get_open_tasks") {
    let tasks = await listOpenTasks();
    if (ctx.projectId) {
      tasks = tasks.filter((item) => item.projectId === ctx.projectId);
    }
    if (name === "get_overdue_tasks") {
      tasks = tasks.filter((item) => item.overdue);
    }
    return {
      name,
      ok: true,
      json: JSON.stringify({
        tasks: compact(tasks).map((item) => ({
          title: item.title,
          dueOn: item.dueOn,
          status: item.status,
          projectName: item.projectName,
          overdue: item.overdue,
        })),
      }),
    };
  }

  if (name === "get_delayed_processes") {
    let rows = await listDelayedProcesses();
    if (ctx.projectId) {
      rows = rows.filter((item) => item.projectId === ctx.projectId);
    }
    return {
      name,
      ok: true,
      json: JSON.stringify({
        processes: compact(rows).map((item) => ({
          name: item.name,
          percent: item.percent,
          plannedEndOn: item.plannedEndOn,
          projectName: item.projectName,
        })),
      }),
    };
  }

  if (name === "get_pending_items") {
    return {
      name,
      ok: true,
      json: JSON.stringify({
        pendingConfirmCount: facts.pendingConfirmCount,
        draftReportCount: facts.draftReportCount,
      }),
    };
  }

  if (name === "list_reports") {
    const reports = ctx.projectId
      ? (await listRecentReports()).filter((item) => item.projectId === ctx.projectId)
      : await listRecentReports();
    const drafts = ctx.projectId
      ? (await listDraftReports()).filter((item) => item.projectId === ctx.projectId)
      : await listDraftReports();
    return {
      name,
      ok: true,
      json: JSON.stringify({
        recent: compact(reports, 12).map((item) => ({
          id: item.id,
          workOn: item.workOn,
          status: item.status,
          projectName: item.projectName,
          excerpt: item.body.slice(0, 80),
        })),
        drafts: compact(drafts, 8).map((item) => ({
          id: item.id,
          workOn: item.workOn,
          projectName: item.projectName,
        })),
      }),
    };
  }

  if (name === "list_today_photos") {
    const photos = await searchPhotos(
      {
        projectId: ctx.projectId ?? undefined,
        from: ctx.today,
        to: ctx.today,
      },
      { skipUrls: true },
    );
    return {
      name,
      ok: true,
      json: JSON.stringify({
        count: photos.length,
        photos: compact(photos, 15).map((item) => ({
          id: item.id,
          projectName: item.projectName,
          takenAt: item.takenAt,
          workType: item.workTypeKey,
          location: item.locationSpot,
          href: `/photos/${item.id}`,
        })),
      }),
    };
  }

  if (name === "list_unfiled_photos") {
    const photos = await searchPhotos(
      {
        projectId: ctx.projectId ?? undefined,
        unfiledOnly: true,
      },
      { skipUrls: true },
    );
    return {
      name,
      ok: true,
      json: JSON.stringify({
        count: photos.length,
        photos: compact(photos, 15).map((item) => ({
          id: item.id,
          status: item.classificationStatus,
          fileHint: item.comment ?? item.proposedDescription,
          href: `/photos/${item.id}`,
        })),
      }),
    };
  }

  if (name === "get_recent_chat") {
    if (!ctx.projectId) {
      return { name, ok: false, json: JSON.stringify({ error: "チャットを見るには現場を指定してください。" }) };
    }
    const messages = await listProjectMessages(ctx.projectId);
    return {
      name,
      ok: true,
      json: JSON.stringify({
        messages: compact(messages, 12).map((item) => ({
          sender: item.senderName,
          body: item.body.slice(0, 120),
          at: item.createdAt,
        })),
      }),
    };
  }

  if (name === "get_similar_projects") {
    if (!ctx.projectId) {
      return { name, ok: false, json: JSON.stringify({ error: "類似現場には現場の指定が必要です。" }) };
    }
    const similar = await similarProjectsFor(workspace.organizationId, ctx.projectId);
    return {
      name,
      ok: true,
      json: JSON.stringify({
        matches:
          similar?.matches.map((item) => ({
            name: item.name,
            reason: item.reasons[0]?.label ?? "類似",
            delayedCount: item.delayedCount,
          })) ?? [],
      }),
    };
  }

  if (name === "propose_daily_report_draft") {
    if (!can(workspace, "capture.confirm") && !can(workspace, "project.update")) {
      return { name, ok: false, json: JSON.stringify({ error: "日報を作る権限がありません。" }) };
    }
    if (!ctx.projectId) {
      return { name, ok: false, json: JSON.stringify({ error: "日報下書きには現場が必要です。まだ作成していません。" }) };
    }
    const photos = await searchPhotos(
      { projectId: ctx.projectId, from: ctx.today, to: ctx.today },
      { skipUrls: true },
    );
    const proposal: StrategistProposal = {
      kind: "report_draft",
      projectId: ctx.projectId,
      projectName: ctx.projectName,
      summary: `${ctx.today} の写真 ${photos.length} 枚を使って日報下書きを作ります。確定はしません。`,
    };
    return {
      name,
      ok: true,
      json: JSON.stringify({ proposed: true, ...proposal }),
      proposal,
    };
  }

  if (name === "propose_create_tasks") {
    if (!can(workspace, "project.update") && !can(workspace, "capture.create")) {
      return { name, ok: false, json: JSON.stringify({ error: "タスクを作る権限がありません。" }) };
    }
    if (!ctx.projectId) {
      return { name, ok: false, json: JSON.stringify({ error: "タスク作成には現場が必要です。まだ作成していません。" }) };
    }
    const titles = ctx.titles.length > 0 ? ctx.titles : proposeTaskTitles(facts);
    if (titles.length === 0) {
      return { name, ok: false, json: JSON.stringify({ error: "提案できるタスクがありません。" }) };
    }
    const proposal: StrategistProposal = {
      kind: "create_tasks",
      projectId: ctx.projectId,
      projectName: ctx.projectName,
      titles,
    };
    return { name, ok: true, json: JSON.stringify({ proposed: true, titles }), proposal };
  }

  if (name === "propose_photo_classify") {
    if (!can(workspace, "photo.create")) {
      return { name, ok: false, json: JSON.stringify({ error: "写真を更新する権限がありません。" }) };
    }
    const photos =
      ctx.photoIds.length > 0
        ? (await searchPhotos({ projectId: ctx.projectId ?? undefined }, { skipUrls: true })).filter((item) =>
            ctx.photoIds.includes(item.id),
          )
        : await searchPhotos({ projectId: ctx.projectId ?? undefined, unfiledOnly: true }, { skipUrls: true });
    const items = compact(photos, 8).map((item) => {
      const classified = classifyPhotoHeuristic(item.comment ?? item.storagePath);
      return {
        photoId: item.id,
        label: photoAssistFromFilename(item.comment ?? undefined, classified.description),
      };
    });
    if (items.length === 0) {
      return { name, ok: false, json: JSON.stringify({ error: "対象の未整理写真がありません。" }) };
    }
    const proposal: StrategistProposal = {
      kind: "photo_classify",
      projectId: ctx.projectId,
      items,
    };
    return { name, ok: true, json: JSON.stringify({ proposed: true, count: items.length }), proposal };
  }

  return { name, ok: false, json: JSON.stringify({ error: "未対応のツールです。" }) };
}
