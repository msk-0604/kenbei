import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors } from "../theme";
import { tokyoTodayIso } from "../lib/dates";
import { REPORT_STATUS_LABELS } from "../lib/ops-labels";
import { can } from "../lib/permissions";
import { hasOrganization, useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import type { AccountStackParamList } from "../navigation";

type ReportRow = {
  id: string;
  project_id: string;
  work_on: string;
  status: string;
  body: string;
  projectName: string;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function ReportsScreen() {
  const { workspace } = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<AccountStackParamList>>();
  const route = useRoute<RouteProp<AccountStackParamList, "ReportsList">>();
  const projectId = route.params?.projectId;
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const writable = can(workspace?.permissions ?? [], "capture.confirm") || can(workspace?.permissions ?? [], "project.update");

  const load = useCallback(async () => {
    if (!workspace?.organizationId) {
      return;
    }
    setLoading(true);
    let query = supabase
      .from("daily_reports")
      .select("id, project_id, work_on, status, body, projects(name)")
      .eq("organization_id", workspace.organizationId)
      .is("deleted_at", null)
      .order("work_on", { ascending: false })
      .limit(40);
    if (projectId) {
      query = query.eq("project_id", projectId);
    }
    const [{ data }, { data: projectRows }] = await Promise.all([
      query,
      supabase
        .from("projects")
        .select("id, name")
        .eq("organization_id", workspace.organizationId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(40),
    ]);
    setProjects((projectRows as { id: string; name: string }[] | null) ?? []);
    setRows(
      ((data as { id: string; project_id: string; work_on: string; status: string; body: string; projects: { name: string } | { name: string }[] | null }[] | null) ?? []).map(
        (row) => ({
          id: row.id,
          project_id: row.project_id,
          work_on: row.work_on,
          status: row.status,
          body: row.body,
          projectName: one(row.projects)?.name ?? "",
        }),
      ),
    );
    setLoading(false);
  }, [workspace, projectId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function openNew() {
    const selected =
      (projectId && projects.find((item) => item.id === projectId)) ||
      (route.params?.projectId
        ? { id: route.params.projectId, name: route.params.projectName ?? "現場" }
        : projects[0]);
    if (!selected) {
      Alert.alert("現場がありません");
      return;
    }
    navigation.navigate("ReportForm", {
      projectId: selected.id,
      projectName: selected.name,
      workOn: tokyoTodayIso(),
    });
  }

  if (!hasOrganization(workspace)) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>会社に参加すると日報が表示されます。</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {writable ? (
        <Pressable style={styles.create} onPress={openNew}>
          <Text style={styles.createText}>今日の日報</Text>
        </Pressable>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.muted}>日報はまだありません。</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              navigation.navigate("ReportForm", {
                reportId: item.id,
                projectId: item.project_id,
                projectName: item.projectName,
                workOn: item.work_on,
              })
            }
          >
            <Text style={styles.title}>
              {item.projectName} · {item.work_on}
            </Text>
            <Text style={styles.meta}>{REPORT_STATUS_LABELS[item.status] ?? item.status}</Text>
            <Text style={styles.body} numberOfLines={2}>
              {item.body || "（本文なし）"}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: 16 },
  center: { flex: 1, justifyContent: "center", padding: 24 },
  create: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  createText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  list: { paddingBottom: 40 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 10,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  meta: { marginTop: 4, color: colors.muted, fontSize: 13 },
  body: { marginTop: 8, color: colors.ink, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 15 },
});
