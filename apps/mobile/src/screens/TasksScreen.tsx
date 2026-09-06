import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors } from "../theme";
import { tokyoTodayIso } from "../lib/dates";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "../lib/ops-labels";
import { isTaskOverdue } from "../lib/ops-logic";
import { can } from "../lib/permissions";
import { hasOrganization, useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import { ChipRow } from "../components/OpsUi";
import type { AccountStackParamList } from "../navigation";

export type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_on: string | null;
  priority: string;
  status: string;
  assignee_membership_id: string | null;
  projectName: string;
  assigneeName: string | null;
};

type Filter = "open" | "mine" | "done" | "all";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function TasksScreen() {
  const { workspace } = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<AccountStackParamList>>();
  const route = useRoute<RouteProp<AccountStackParamList, "TasksList">>();
  const projectId = route.params?.projectId;
  const [filter, setFilter] = useState<Filter>("open");
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const today = tokyoTodayIso();
  const writable = can(workspace?.permissions ?? [], "project.update") || can(workspace?.permissions ?? [], "capture.create");

  const load = useCallback(async () => {
    if (!workspace?.organizationId) {
      return;
    }
    setLoading(true);
    let query = supabase
      .from("project_tasks")
      .select(
        "id, project_id, title, description, due_on, priority, status, assignee_membership_id, projects(name), memberships:assignee_membership_id(profiles!profile_id(display_name))",
      )
      .eq("organization_id", workspace.organizationId)
      .is("deleted_at", null)
      .order("due_on", { ascending: true, nullsFirst: false })
      .limit(80);
    if (projectId) {
      query = query.eq("project_id", projectId);
    }
    const { data } = await query;
    const mapped: TaskRow[] =
      ((data as {
        id: string;
        project_id: string;
        title: string;
        description: string | null;
        due_on: string | null;
        priority: string;
        status: string;
        assignee_membership_id: string | null;
        projects: { name: string } | { name: string }[] | null;
        memberships:
          | { profiles: { display_name: string } | { display_name: string }[] | null }
          | { profiles: { display_name: string } | { display_name: string }[] | null }[]
          | null;
      }[] | null) ?? []).map((row) => ({
        id: row.id,
        project_id: row.project_id,
        title: row.title,
        description: row.description,
        due_on: row.due_on,
        priority: row.priority,
        status: row.status,
        assignee_membership_id: row.assignee_membership_id,
        projectName: one(row.projects)?.name ?? "",
        assigneeName: one(one(row.memberships)?.profiles ?? null)?.display_name ?? null,
      }));
    setRows(mapped);
    setLoading(false);
  }, [workspace, projectId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible = useMemo(() => {
    return rows.filter((row) => {
      if (filter === "open") {
        return row.status !== "done";
      }
      if (filter === "done") {
        return row.status === "done";
      }
      if (filter === "mine") {
        return row.assignee_membership_id === workspace?.membershipId;
      }
      return true;
    });
  }, [rows, filter, workspace]);

  async function markDone(task: TaskRow) {
    if (!writable) {
      Alert.alert("権限がありません");
      return;
    }
    const { error } = await supabase
      .from("project_tasks")
      .update({ status: "done", updated_by: workspace?.userId })
      .eq("id", task.id)
      .eq("organization_id", workspace?.organizationId ?? "");
    if (error) {
      Alert.alert("更新できません", error.message);
      return;
    }
    await load();
  }

  if (!hasOrganization(workspace)) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>会社に参加するとタスクが表示されます。</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ChipRow
        value={filter}
        onChange={(value) => setFilter(value as Filter)}
        options={[
          { value: "open", label: "未完了" },
          { value: "mine", label: "自分" },
          { value: "done", label: "完了" },
          { value: "all", label: "すべて" },
        ]}
      />
      {writable ? (
        <Pressable
          style={styles.create}
          onPress={() =>
            navigation.navigate("TaskForm", {
              projectId: projectId ?? route.params?.projectId,
              projectName: route.params?.projectName,
            })
          }
        >
          <Text style={styles.createText}>タスクを作る</Text>
        </Pressable>
      ) : null}
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.muted}>タスクはありません。</Text>}
        renderItem={({ item }) => {
          const overdue = isTaskOverdue({ status: item.status, dueOn: item.due_on, todayIso: today });
          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                navigation.navigate("TaskForm", {
                  taskId: item.id,
                  projectId: item.project_id,
                  projectName: item.projectName,
                })
              }
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                {item.projectName} · {TASK_STATUS_LABELS[item.status] ?? item.status} ·{" "}
                {PRIORITY_LABELS[item.priority] ?? item.priority}
              </Text>
              <Text style={[styles.meta, overdue && styles.overdue]}>
                期限 {item.due_on ?? "なし"} · {item.assigneeName ?? "未担当"}
                {overdue ? " · 期限切れ" : ""}
              </Text>
              {item.status !== "done" && writable ? (
                <Pressable style={styles.done} onPress={() => void markDone(item)}>
                  <Text style={styles.doneText}>完了</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, paddingTop: 12, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: "center", padding: 24 },
  list: { paddingBottom: 40, paddingTop: 8 },
  create: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  createText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 10,
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.ink },
  meta: { marginTop: 6, color: colors.muted, fontSize: 13 },
  overdue: { color: colors.danger, fontWeight: "700" },
  done: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  muted: { color: colors.muted, fontSize: 15 },
});
