import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors } from "../theme";
import { addDaysIso } from "../lib/ops-logic";
import { tokyoTodayIso } from "../lib/dates";
import { PRIORITIES, PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS } from "../lib/ops-labels";
import { can } from "../lib/permissions";
import { useSession } from "../lib/session";
import { notifyOrgMembers } from "../lib/notify-client";
import { supabase } from "../lib/supabase";
import { ChipRow } from "../components/OpsUi";
import type { AccountStackParamList } from "../navigation";

type MemberOption = { id: string; name: string };
type ProjectOption = { id: string; name: string };

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function TaskFormScreen() {
  const { workspace } = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<AccountStackParamList>>();
  const route = useRoute<RouteProp<AccountStackParamList, "TaskForm">>();
  const writable = can(workspace?.permissions ?? [], "project.update") || can(workspace?.permissions ?? [], "capture.create");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueOn, setDueOn] = useState<string | null>(null);
  const [priority, setPriority] = useState("normal");
  const [status, setStatus] = useState("todo");
  const [projectId, setProjectId] = useState(route.params?.projectId ?? "");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [initialAssigneeId, setInitialAssigneeId] = useState<string>("");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!workspace?.organizationId) {
      return;
    }
    const [{ data: projectRows }, { data: memberRows }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name")
        .eq("organization_id", workspace.organizationId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(50),
      supabase
        .from("memberships")
        .select("id, profiles!profile_id(display_name)")
        .eq("organization_id", workspace.organizationId)
        .eq("status", "active")
        .is("deleted_at", null),
    ]);
    setProjects((projectRows as ProjectOption[] | null) ?? []);
    setMembers(
      ((memberRows as { id: string; profiles: { display_name: string } | { display_name: string }[] | null }[] | null) ?? []).map(
        (row) => ({ id: row.id, name: one(row.profiles)?.display_name ?? "メンバー" }),
      ),
    );
    if (route.params?.taskId) {
      const { data } = await supabase
        .from("project_tasks")
        .select("title, description, due_on, priority, status, project_id, assignee_membership_id")
        .eq("id", route.params.taskId)
        .maybeSingle();
      const row = data as {
        title: string;
        description: string | null;
        due_on: string | null;
        priority: string;
        status: string;
        project_id: string;
        assignee_membership_id: string | null;
      } | null;
      if (row) {
        setTitle(row.title);
        setDescription(row.description ?? "");
        setDueOn(row.due_on);
        setPriority(row.priority);
        setStatus(row.status);
        setProjectId(row.project_id);
        setAssigneeId(row.assignee_membership_id ?? "");
        setInitialAssigneeId(row.assignee_membership_id ?? "");
      }
    } else if (!route.params?.taskId && !route.params?.projectId && projectRows && projectRows[0]) {
      setProjectId((projectRows[0] as ProjectOption).id);
    }
  }, [workspace, route.params]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function save() {
    if (!writable || !workspace?.organizationId) {
      Alert.alert("権限がありません");
      return;
    }
    if (!title.trim() || !projectId) {
      Alert.alert("タスク名と現場を指定してください。");
      return;
    }
    setBusy(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      due_on: dueOn,
      priority,
      status,
      project_id: projectId,
      assignee_membership_id: assigneeId || null,
      updated_by: workspace.userId,
    };
    let taskId = route.params?.taskId;
    const result = taskId
      ? await supabase
          .from("project_tasks")
          .update(payload)
          .eq("id", taskId)
          .eq("organization_id", workspace.organizationId)
      : await supabase
          .from("project_tasks")
          .insert({
            ...payload,
            organization_id: workspace.organizationId,
            created_by: workspace.userId,
          })
          .select("id")
          .maybeSingle();
    if (result.error) {
      setBusy(false);
      Alert.alert("保存できません", result.error.message);
      return;
    }
    if (!taskId) {
      taskId = (result.data as { id: string } | null)?.id;
    }
    if (taskId && assigneeId && assigneeId !== initialAssigneeId) {
      const member = await supabase
        .from("memberships")
        .select("profile_id")
        .eq("id", assigneeId)
        .eq("organization_id", workspace.organizationId)
        .maybeSingle();
      const profileId = (member.data as { profile_id: string } | null)?.profile_id;
      if (profileId && profileId !== workspace.userId) {
        await notifyOrgMembers({
          organizationId: workspace.organizationId,
          projectId,
          kind: "task_assignment",
          title: "タスクが割り当てられました",
          body: title.trim(),
          href: `/tasks/${taskId}`,
          profileIds: [profileId],
          extra: { taskId, projectId },
        });
      }
    }
    if (status === "review") {
      await notifyOrgMembers({
        organizationId: workspace.organizationId,
        projectId,
        kind: "confirm_request",
        title: "タスクの確認依頼があります",
        body: title.trim(),
        href: "/confirm",
        permissionAudience: "capture.confirm",
        extra: { taskId: taskId ?? "", projectId },
      });
    }
    setBusy(false);
    navigation.goBack();
  }

  const today = tokyoTodayIso();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>現場</Text>
      <ChipRow
        value={projectId}
        onChange={setProjectId}
        options={projects.map((item) => ({ value: item.id, label: item.name }))}
      />
      <Text style={styles.label}>タスク</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="例: 配筋確認" />
      <Text style={styles.label}>期限</Text>
      <ChipRow
        value={dueOn ?? "none"}
        onChange={(value) => setDueOn(value === "none" ? null : value)}
        options={[
          { value: "none", label: "なし" },
          { value: today, label: "今日" },
          { value: addDaysIso(today, 1), label: "明日" },
        ]}
      />
      <Text style={styles.label}>優先度</Text>
      <ChipRow
        value={priority}
        onChange={setPriority}
        options={PRIORITIES.map((item) => ({ value: item, label: PRIORITY_LABELS[item] ?? item }))}
      />
      <Text style={styles.label}>状態</Text>
      <ChipRow
        value={status}
        onChange={setStatus}
        options={TASK_STATUSES.map((item) => ({ value: item, label: TASK_STATUS_LABELS[item] ?? item }))}
      />
      <Text style={styles.label}>担当</Text>
      <ChipRow
        value={assigneeId || "none"}
        onChange={(value) => setAssigneeId(value === "none" ? "" : value)}
        options={[{ value: "none", label: "未担当" }, ...members.map((item) => ({ value: item.id, label: item.name }))]}
      />
      <Text style={styles.label}>メモ</Text>
      <TextInput
        style={[styles.input, styles.area]}
        value={description}
        onChangeText={setDescription}
        placeholder="任意"
        multiline
      />
      <Pressable style={styles.save} onPress={() => void save()} disabled={busy}>
        <Text style={styles.saveText}>{busy ? "保存中…" : "保存"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 40 },
  label: { marginTop: 16, marginBottom: 8, fontWeight: "700", color: colors.muted, fontSize: 13 },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
  },
  area: { minHeight: 96, textAlignVertical: "top", paddingTop: 12 },
  save: {
    marginTop: 24,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 17 },
});
