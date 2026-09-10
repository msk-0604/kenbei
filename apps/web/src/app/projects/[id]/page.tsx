import Link from "next/link";
import { notFound } from "next/navigation";
import { DRAWING_KIND_LABELS, formatFieldValue, PROJECT_STATUS_LABELS } from "@kensapo/domain";
import { AppShell } from "@/components/app-shell";
import { AssignMemberForm, AssignmentList, EditProjectForm } from "@/features/projects/forms";
import {
  getProject,
  listAssignments,
  listConfirmedFields,
  listOrgMembers,
  listProjectCaptures,
  listWorkEvents,
} from "@/features/projects/queries";
import { searchPhotos } from "@/features/photos/queries";
import { PhotoUploader } from "@/features/photos/uploader";
import { listProjectReports } from "@/features/reports/queries";
import { CreateTodayReportButton } from "@/features/reports/forms";
import {
  listProjectProcesses,
  listProjectTasks,
  overallProgress,
} from "@/features/site-ops/queries";
import { CreateProcessForm, CreateTaskForm, ProcessList, TaskList } from "@/features/site-ops/forms";
import { listProjectDrawings } from "@/features/drawings/queries";
import { DrawingUploadForm } from "@/features/drawings/upload-form";
import { listProjectChatMembers, listProjectMessages } from "@/features/chat/queries";
import { ProjectChatPanel } from "@/features/chat/chat-panel";
import { GanttChart } from "@/features/gantt/gantt-chart";
import { SimilarProjectsPanel } from "@/features/similar/panel";
import { similarProjectsFor } from "@/features/similar/queries";
import { StrategistForm } from "@/features/strategist/form";
import { can, requireWorkspace } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "overview", label: "概要" },
  { id: "photos", label: "写真" },
  { id: "reports", label: "日報" },
  { id: "schedule", label: "工程" },
  { id: "chat", label: "チャット" },
  { id: "tasks", label: "タスク" },
  { id: "files", label: "図面" },
  { id: "members", label: "メンバー" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTab(value: string | undefined): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const workspace = await requireWorkspace();
  const { id } = await params;
  const query = await searchParams;
  const tab: TabId = isTab(query.tab) ? query.tab : "overview";
  const project = await getProject(id);
  if (!project) {
    notFound();
  }

  const canAssign = can(workspace, "project.update") || can(workspace, "member.manage");
  const canEdit = can(workspace, "project.update");
  const canPhoto = can(workspace, "photo.create");
  const statusLabel = PROJECT_STATUS_LABELS[project.status as keyof typeof PROJECT_STATUS_LABELS] ?? project.status;

  const [assignments, members, processes, similar] = await Promise.all([
    listAssignments(id),
    listOrgMembers(),
    listProjectProcesses(id),
    similarProjectsFor(workspace.organizationId, id),
  ]);
  const manager =
    assignments.find((row) => row.roleInProject === "supervisor" || row.roleInProject === "manager") ??
    assignments[0];

  return (
    <AppShell>
      <p className="text-sm text-zinc-500">
        <Link href="/projects">現場</Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{project.name}</h1>
      <p className="mt-2 text-base text-zinc-600">
        {statusLabel}
        {project.customerName ? ` / ${project.customerName}` : ""}
      </p>
      <p className="text-sm text-zinc-500">{project.address ?? "住所未登録"}</p>
      <p className="mt-2 text-sm text-zinc-500">全体進捗 {overallProgress(processes)}%</p>

      <nav className="-mx-5 mt-6 flex gap-1 overflow-x-auto px-5 md:mx-0 md:px-0">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/projects/${id}?tab=${item.id}`}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm ${tab === item.id ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="mt-6 flex flex-col gap-6">
          <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
            <p className="text-base">{project.workSummary ?? "工事内容は未登録です。"}</p>
            {project.cautionNote ? <p className="mt-3 text-sm text-red-800">注意: {project.cautionNote}</p> : null}
            <p className="mt-3 text-sm text-zinc-500">
              工期 {project.plannedStartOn ?? "未定"} 〜 {project.plannedEndOn ?? "未定"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">責任者 {manager?.displayName ?? "未設定"}</p>
            <a href={`/api/pdf/project/${id}`} className="mt-3 inline-flex text-sm underline">
              現場サマリーPDF
            </a>
          </section>
          <SimilarProjectsPanel result={similar} />
          <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
            <h2 className="mb-3 text-base font-medium">この現場の軍師</h2>
            <StrategistForm projectId={id} />
          </section>
          {canEdit ? (
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
              <h2 className="mb-3 text-base font-medium">基本情報</h2>
              <EditProjectForm
                projectId={id}
                name={project.name}
                address={project.address}
                workSummary={project.workSummary}
                cautionNote={project.cautionNote}
                customerName={project.customerName}
                status={project.status}
                plannedStartOn={project.plannedStartOn}
                plannedEndOn={project.plannedEndOn}
              />
            </section>
          ) : null}
          <VoiceHistory projectId={id} />
        </div>
      ) : null}

      {tab === "photos" ? (
        <PhotosTab
          projectId={id}
          organizationId={workspace.organizationId}
          projectName={project.name}
          companyName={workspace.organizationName}
          canUpload={canPhoto}
        />
      ) : null}

      {tab === "reports" ? <ReportsTab projectId={id} /> : null}

      {tab === "schedule" ? (
        <div className="mt-6 flex flex-col gap-6">
          <GanttChart processes={processes} />
          <ProcessList processes={processes} projectId={id} />
          {canEdit ? (
            <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
              <h2 className="mb-3 text-base font-medium">工程を追加</h2>
              <CreateProcessForm projectId={id} />
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "chat" ? (
        <ChatTab projectId={id} organizationId={workspace.organizationId} userId={workspace.userId} />
      ) : null}

      {tab === "tasks" ? (
        <TasksTab projectId={id} members={members} />
      ) : null}

      {tab === "files" ? (
        <FilesTab projectId={id} canUpload={canEdit || can(workspace, "import.manage")} />
      ) : null}

      {tab === "members" ? (
        <section className="mt-6">
          <AssignmentList assignments={assignments} />
          {canAssign ? (
            <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
              <AssignMemberForm projectId={id} members={members} />
            </div>
          ) : null}
        </section>
      ) : null}
    </AppShell>
  );
}

async function PhotosTab({
  projectId,
  organizationId,
  projectName,
  companyName,
  canUpload,
}: {
  projectId: string;
  organizationId: string;
  projectName: string;
  companyName: string;
  canUpload: boolean;
}) {
  const photos = await searchPhotos({ projectId });
  return (
    <div className="mt-6 flex flex-col gap-6">
      {canUpload ? (
        <PhotoUploader
          organizationId={organizationId}
          projectId={projectId}
          projectName={projectName}
          companyName={companyName}
        />
      ) : null}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {photos.map((photo) => (
          <li key={photo.id}>
            <Link href={`/photos/${photo.id}`} className="block overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-100">
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt="" className="h-36 w-full object-cover" />
              ) : (
                <div className="flex h-36 items-center justify-center text-sm text-zinc-400">画像なし</div>
              )}
              <p className="px-3 py-2 text-xs text-zinc-600">
                {photo.workTypeKey ?? "未分類"} {photo.locationSpot ?? ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {photos.length === 0 ? <p className="text-sm text-zinc-500">写真はまだありません。</p> : null}
    </div>
  );
}

async function ReportsTab({ projectId }: { projectId: string }) {
  const reports = await listProjectReports(projectId);
  return (
    <div className="mt-6 flex flex-col gap-4">
      <CreateTodayReportButton projectId={projectId} />
      <ul className="flex flex-col gap-2">
        {reports.map((report) => (
          <li key={report.id}>
            <Link href={`/reports/${report.id}`} className="block rounded-3xl bg-white p-4 ring-1 ring-zinc-100">
              <p className="font-medium">{report.workOn}</p>
              <p className="text-sm text-zinc-500">{report.status === "confirmed" ? "確定" : "下書き"}</p>
            </Link>
          </li>
        ))}
      </ul>
      {reports.length === 0 ? <p className="text-sm text-zinc-500">日報はまだありません。</p> : null}
    </div>
  );
}

async function ChatTab({
  projectId,
  organizationId,
  userId,
}: {
  projectId: string;
  organizationId: string;
  userId: string;
}) {
  const [messages, members] = await Promise.all([
    listProjectMessages(projectId),
    listProjectChatMembers(projectId),
  ]);
  return (
    <div className="mt-6 flex flex-col gap-6">
      <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
        <h2 className="mb-3 text-base font-medium">チャットを軍師に聞く</h2>
        <StrategistForm projectId={projectId} />
      </section>
      <ProjectChatPanel
        projectId={projectId}
        organizationId={organizationId}
        userId={userId}
        initial={messages}
        members={members}
      />
    </div>
  );
}

async function TasksTab({
  projectId,
  members,
}: {
  projectId: string;
  members: { membershipId: string; displayName: string; roleCode: string }[];
}) {
  const tasks = await listProjectTasks(projectId);
  return (
    <div className="mt-6 flex flex-col gap-6">
      <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
        <h2 className="mb-3 text-base font-medium">タスクを軍師に聞く</h2>
        <StrategistForm projectId={projectId} />
      </section>
      <TaskList tasks={tasks} />
      <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
        <h2 className="mb-3 text-base font-medium">タスクを追加</h2>
        <CreateTaskForm projectId={projectId} members={members} />
      </section>
    </div>
  );
}

async function FilesTab({ projectId, canUpload }: { projectId: string; canUpload: boolean }) {
  const drawings = await listProjectDrawings(projectId);
  return (
    <div className="mt-6 flex flex-col gap-6">
      {canUpload ? (
        <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-100">
          <h2 className="mb-3 text-base font-medium">PDF図面を登録</h2>
          <DrawingUploadForm projectId={projectId} series={drawings} />
        </section>
      ) : null}
      <ul className="flex flex-col gap-2">
        {drawings.map((doc) => (
          <li key={doc.seriesId} className="rounded-3xl bg-white p-4 ring-1 ring-zinc-100">
            <p className="font-medium">{doc.title}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {DRAWING_KIND_LABELS[doc.drawingKind as keyof typeof DRAWING_KIND_LABELS] ?? "図面"}
              {" / "}v{doc.version}
              {doc.isLatest ? " / 最新" : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {doc.url ? (
                <>
                  <a href={doc.url} target="_blank" rel="noreferrer" className="underline">
                    開く
                  </a>
                  <a href={doc.url} download className="underline">
                    ダウンロード
                  </a>
                </>
              ) : null}
            </div>
            {doc.versions.length > 1 ? (
              <p className="mt-2 text-xs text-zinc-500">
                履歴{" "}
                {doc.versions.map((item) =>
                  item.url ? (
                    <a key={item.id} href={item.url} className="ml-2 underline">
                      v{item.version}
                    </a>
                  ) : (
                    <span key={item.id} className="ml-2">
                      v{item.version}
                    </span>
                  ),
                )}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {drawings.length === 0 ? <p className="text-sm text-zinc-500">PDF図面はまだありません。</p> : null}
    </div>
  );
}

async function VoiceHistory({ projectId }: { projectId: string }) {
  const [captures, events, confirmed] = await Promise.all([
    listProjectCaptures(projectId),
    listWorkEvents(projectId),
    listConfirmedFields(projectId),
  ]);
  return (
    <>
      <section>
        <h2 className="mb-3 text-lg font-medium">音声報告</h2>
        <ul className="flex flex-col gap-2">
          {captures.map((capture) => (
            <li key={capture.id} className="rounded-3xl bg-white p-4 text-sm ring-1 ring-zinc-100">
              <p className="line-clamp-2 text-zinc-700">{capture.transcript ?? "整理中"}</p>
              <p className="mt-2 text-zinc-500">
                {capture.graphAppliedAt ? "確定済み" : capture.pendingCount > 0 ? "確認待ち" : "未確定"}
              </p>
              {!capture.graphAppliedAt ? (
                <Link href={`/captures/${capture.id}/confirm`} className="mt-2 inline-flex font-medium underline">
                  確認する
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
        {captures.length === 0 ? <p className="text-sm text-zinc-500">音声報告はまだありません。</p> : null}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-medium">確定した記録</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {confirmed.map((row) => (
            <li key={row.id} className="rounded-2xl bg-zinc-50 px-4 py-3">
              {row.field_key}: {formatFieldValue(row.confirmed_value_json)}
            </li>
          ))}
        </ul>
        {confirmed.length === 0 ? <p className="text-sm text-zinc-500">確定データはまだありません。</p> : null}
      </section>
      <section className="mb-4">
        <h2 className="mb-3 text-lg font-medium">現場の記録</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {events.map((event) => (
            <li key={event.id} className="rounded-3xl bg-white p-4 ring-1 ring-zinc-100">
              <p className="font-medium">{event.workDescription ?? event.workTypeKey ?? "作業"}</p>
              <p className="mt-1 text-zinc-500">
                {[event.location, event.issue, event.nextAction].filter(Boolean).join(" / ")}
              </p>
            </li>
          ))}
        </ul>
        {events.length === 0 ? <p className="text-sm text-zinc-500">確定後にここに残ります。</p> : null}
      </section>
    </>
  );
}
