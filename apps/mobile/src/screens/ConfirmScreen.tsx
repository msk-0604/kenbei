import { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { colors } from "../theme";
import { tokyoTodayIso } from "../lib/dates";
import { isProcessDelayed, isTaskOverdue } from "../lib/ops-logic";
import { can } from "../lib/permissions";
import { hasOrganization, useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import { ActionRow } from "../components/OpsUi";
import type { MainTabParamList } from "../navigation";

type ConfirmCard = {
  id: string;
  kind: "capture" | "photo" | "report" | "process" | "task";
  title: string;
  subtitle: string;
  projectId: string | null;
  projectName: string;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function stringifyValue(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function ConfirmScreen() {
  const { workspace } = useSession();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [items, setItems] = useState<ConfirmCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const today = tokyoTodayIso();
  const canCapture = can(workspace?.permissions ?? [], "capture.confirm");
  const canPhoto = can(workspace?.permissions ?? [], "photo.create");
  const canTask = can(workspace?.permissions ?? [], "project.update") || can(workspace?.permissions ?? [], "capture.create");
  const canProcess = can(workspace?.permissions ?? [], "project.update");

  const load = useCallback(async () => {
    if (!workspace?.organizationId) {
      return;
    }
    setLoading(true);
    const orgId = workspace.organizationId;
    const [captures, photos, reports, processes, tasks] = await Promise.all([
      supabase
        .from("capture_fields")
        .select("id, field_key, proposed_value_json, project_id, projects(name)")
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .is("deleted_at", null)
        .limit(20),
      supabase
        .from("photos")
        .select("id, project_id, proposed_description, proposed_work_type_key, proposed_location_spot, proposed_tags, projects(name)")
        .eq("organization_id", orgId)
        .eq("classification_status", "proposed")
        .is("deleted_at", null)
        .limit(20),
      supabase
        .from("daily_reports")
        .select("id, project_id, work_on, projects(name)")
        .eq("organization_id", orgId)
        .eq("status", "draft")
        .is("deleted_at", null)
        .limit(20),
      supabase
        .from("processes")
        .select("id, name, percent, status, planned_end_on, project_id, projects(name)")
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .limit(40),
      supabase
        .from("project_tasks")
        .select("id, title, status, due_on, project_id, projects(name)")
        .eq("organization_id", orgId)
        .eq("status", "review")
        .is("deleted_at", null)
        .limit(20),
    ]);

    const cards: ConfirmCard[] = [];
    for (const row of (captures.data as {
      id: string;
      field_key: string;
      proposed_value_json: unknown;
      project_id: string | null;
      projects: { name: string } | { name: string }[] | null;
    }[] | null) ?? []) {
      cards.push({
        id: row.id,
        kind: "capture",
        title: `入力確認 · ${row.field_key}`,
        subtitle: stringifyValue(row.proposed_value_json),
        projectId: row.project_id,
        projectName: one(row.projects)?.name ?? "",
      });
    }
    for (const row of (photos.data as {
      id: string;
      project_id: string | null;
      proposed_description: string | null;
      proposed_work_type_key: string | null;
      proposed_location_spot: string | null;
      projects: { name: string } | { name: string }[] | null;
    }[] | null) ?? []) {
      cards.push({
        id: row.id,
        kind: "photo",
        title: "写真の分類提案",
        subtitle: [row.proposed_work_type_key, row.proposed_location_spot, row.proposed_description]
          .filter(Boolean)
          .join(" · "),
        projectId: row.project_id,
        projectName: one(row.projects)?.name ?? "",
      });
    }
    for (const row of (reports.data as {
      id: string;
      project_id: string;
      work_on: string;
      projects: { name: string } | { name: string }[] | null;
    }[] | null) ?? []) {
      cards.push({
        id: row.id,
        kind: "report",
        title: "日報下書き",
        subtitle: row.work_on,
        projectId: row.project_id,
        projectName: one(row.projects)?.name ?? "",
      });
    }
    for (const row of (processes.data as {
      id: string;
      name: string;
      percent: number;
      status: string;
      planned_end_on: string | null;
      project_id: string;
      projects: { name: string } | { name: string }[] | null;
    }[] | null) ?? []) {
      if (
        !isProcessDelayed({
          status: row.status,
          percent: row.percent,
          plannedEndOn: row.planned_end_on,
          todayIso: today,
        })
      ) {
        continue;
      }
      cards.push({
        id: row.id,
        kind: "process",
        title: `工程遅延 · ${row.name}`,
        subtitle: `${row.percent}% · 終了予定 ${row.planned_end_on ?? "未設定"}`,
        projectId: row.project_id,
        projectName: one(row.projects)?.name ?? "",
      });
    }
    for (const row of (tasks.data as {
      id: string;
      title: string;
      status: string;
      due_on: string | null;
      project_id: string;
      projects: { name: string } | { name: string }[] | null;
    }[] | null) ?? []) {
      cards.push({
        id: row.id,
        kind: "task",
        title: `タスク確認 · ${row.title}`,
        subtitle: isTaskOverdue({ status: row.status, dueOn: row.due_on, todayIso: today })
          ? `期限 ${row.due_on ?? "なし"} · 期限切れ`
          : `期限 ${row.due_on ?? "なし"}`,
        projectId: row.project_id,
        projectName: one(row.projects)?.name ?? "",
      });
    }
    setItems(cards);
    setLoading(false);
  }, [workspace, today]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function fail(error: { message: string } | null) {
    if (error) {
      Alert.alert("更新できません", error.message);
      return true;
    }
    return false;
  }

  async function approve(item: ConfirmCard) {
    if (!workspace) {
      return;
    }
    if (item.kind === "capture") {
      if (!canCapture) {
        Alert.alert("権限がありません");
        return;
      }
      const current = await supabase
        .from("capture_fields")
        .select("proposed_value_json")
        .eq("id", item.id)
        .maybeSingle();
      const proposed = (current.data as { proposed_value_json: unknown } | null)?.proposed_value_json ?? null;
      const { error } = await supabase
        .from("capture_fields")
        .update({
          status: "confirmed",
          confirmed_value_json: proposed,
          confirmed_by: workspace.userId,
          confirmed_at: new Date().toISOString(),
          updated_by: workspace.userId,
        })
        .eq("id", item.id)
        .eq("organization_id", workspace.organizationId);
      if (fail(error)) {
        return;
      }
    } else if (item.kind === "photo") {
      if (!canPhoto) {
        Alert.alert("権限がありません");
        return;
      }
      const current = await supabase
        .from("photos")
        .select("proposed_work_type_key, proposed_location_spot, proposed_tags, floor, area")
        .eq("id", item.id)
        .maybeSingle();
      const row = current.data as {
        proposed_work_type_key: string | null;
        proposed_location_spot: string | null;
        proposed_tags: string[] | null;
        floor: string | null;
        area: string | null;
      } | null;
      if (!row) {
        Alert.alert("写真が見つかりません");
        return;
      }
      const { error } = await supabase
        .from("photos")
        .update({
          work_type_key: row.proposed_work_type_key,
          location_spot: row.proposed_location_spot,
          tags: row.proposed_tags ?? [],
          location_text: [row.floor, row.proposed_location_spot, row.area].filter(Boolean).join(" ") || null,
          classification_status: "confirmed",
        })
        .eq("id", item.id)
        .eq("organization_id", workspace.organizationId);
      if (fail(error)) {
        return;
      }
    } else if (item.kind === "report") {
      if (!canCapture) {
        Alert.alert("権限がありません");
        return;
      }
      const { error } = await supabase
        .from("daily_reports")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          confirmed_by: workspace.userId,
          updated_by: workspace.userId,
        })
        .eq("id", item.id)
        .eq("organization_id", workspace.organizationId)
        .eq("status", "draft");
      if (fail(error)) {
        return;
      }
    } else if (item.kind === "process") {
      setMessage("遅延として確認しました。工程そのものは現場詳細の後続で編集できます。");
      return;
    } else if (item.kind === "task") {
      if (!canTask) {
        Alert.alert("権限がありません");
        return;
      }
      const { error } = await supabase
        .from("project_tasks")
        .update({ status: "done", updated_by: workspace.userId })
        .eq("id", item.id)
        .eq("organization_id", workspace.organizationId);
      if (fail(error)) {
        return;
      }
    }
    setMessage("承認しました");
    await load();
  }

  async function reject(item: ConfirmCard) {
    if (!workspace) {
      return;
    }
    if (item.kind === "capture") {
      if (!canCapture) {
        Alert.alert("権限がありません");
        return;
      }
      const { error } = await supabase
        .from("capture_fields")
        .update({ status: "rejected", updated_by: workspace.userId })
        .eq("id", item.id)
        .eq("organization_id", workspace.organizationId);
      if (fail(error)) {
        return;
      }
    } else if (item.kind === "photo") {
      if (!canPhoto) {
        Alert.alert("権限がありません");
        return;
      }
      const { error } = await supabase
        .from("photos")
        .update({ classification_status: "none" })
        .eq("id", item.id)
        .eq("organization_id", workspace.organizationId);
      if (fail(error)) {
        return;
      }
    } else if (item.kind === "report") {
      setMessage("日報は下書きのまま残しています。詳細から編集できます。");
      return;
    } else if (item.kind === "process") {
      if (!canProcess) {
        Alert.alert("権限がありません");
        return;
      }
      const { error } = await supabase
        .from("processes")
        .update({ status: "in_progress", updated_by: workspace.userId })
        .eq("id", item.id)
        .eq("organization_id", workspace.organizationId);
      if (fail(error)) {
        return;
      }
    } else if (item.kind === "task") {
      if (!canTask) {
        Alert.alert("権限がありません");
        return;
      }
      const { error } = await supabase
        .from("project_tasks")
        .update({ status: "in_progress", updated_by: workspace.userId })
        .eq("id", item.id)
        .eq("organization_id", workspace.organizationId);
      if (fail(error)) {
        return;
      }
    }
    setMessage("差戻しました");
    await load();
  }

  function openDetail(item: ConfirmCard) {
    if (item.kind === "photo") {
      navigation.navigate("Photos", { screen: "PhotoDetail", params: { photoId: item.id, source: "remote" } });
      return;
    }
    if (item.kind === "report" && item.projectId) {
      navigation.navigate("Account", {
        screen: "ReportForm",
        params: {
          reportId: item.id,
          projectId: item.projectId,
          projectName: item.projectName,
          workOn: item.subtitle,
        },
      });
      return;
    }
    if (item.kind === "task" && item.projectId) {
      navigation.navigate("Account", {
        screen: "TaskForm",
        params: { taskId: item.id, projectId: item.projectId, projectName: item.projectName },
      });
      return;
    }
    Alert.alert(item.title, item.subtitle || "詳細は Web でも確認できます。");
  }

  if (!hasOrganization(workspace)) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>会社に参加すると確認待ちが表示されます。</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <Text style={styles.title}>確認</Text>
      {message ? <Text style={styles.note}>{message}</Text> : null}
      {items.length === 0 && !loading ? <Text style={styles.muted}>いま確認するものはありません。</Text> : null}
      {items.map((item) => (
        <View key={`${item.kind}-${item.id}`} style={styles.card}>
          <Text style={styles.kind}>
            {item.kind === "capture"
              ? "入力"
              : item.kind === "photo"
                ? "写真"
                : item.kind === "report"
                  ? "日報"
                  : item.kind === "process"
                    ? "工程"
                    : "タスク"}
          </Text>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.meta}>
            {item.projectName}
            {item.subtitle ? ` · ${item.subtitle}` : ""}
          </Text>
          <ActionRow
            onApprove={() => void approve(item)}
            onReject={() => void reject(item)}
            onDetail={() => openDetail(item)}
          />
        </View>
      ))}
      <Pressable
        style={styles.link}
        onPress={() => navigation.navigate("Account", { screen: "TasksList" })}
      >
        <Text style={styles.linkText}>タスク一覧へ</Text>
      </Pressable>
      <Pressable
        style={styles.link}
        onPress={() => navigation.navigate("Account", { screen: "ReportsList" })}
      >
        <Text style={styles.linkText}>日報一覧へ</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 28, fontWeight: "700", color: colors.ink, marginBottom: 12 },
  note: { marginBottom: 12, color: colors.warn, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 10,
  },
  kind: { fontSize: 11, fontWeight: "700", color: colors.muted },
  cardTitle: { marginTop: 4, fontSize: 16, fontWeight: "700", color: colors.ink },
  meta: { marginTop: 6, color: colors.muted, fontSize: 13, lineHeight: 20 },
  link: { minHeight: 48, justifyContent: "center" },
  linkText: { color: colors.ink, fontWeight: "700" },
});
